import { DurableObject } from "cloudflare:workers";

const TELEGRAM_API = "https://api.telegram.org";
const CHANNEL_USERNAME = "FoodRadarDaily";
const MAX_RECIPES = 200;

const INGREDIENT_ALIASES = {
  картошка: "картофель",
  картошку: "картофель",
  картошки: "картофель",
  картофеля: "картофель",

  помидор: "помидоры",
  помидора: "помидоры",
  помидоров: "помидоры",
  томат: "помидоры",
  томаты: "помидоры",

  яйцо: "яйца",
  яиц: "яйца",

  курицу: "курица",
  курицы: "курица",
  куриное: "курица",
  куриной: "курица",

  грудка: "куриное филе",
  грудку: "куриное филе",
  грудки: "куриное филе",

  фарша: "фарш",
  фаршем: "фарш",

  лука: "лук",
  луком: "лук",

  моркови: "морковь",
  морковкой: "морковь",

  сыра: "сыр",
  сыром: "сыр",

  гриб: "грибы",
  грибов: "грибы",
  грибами: "грибы",

  шампиньон: "шампиньоны",
  шампиньонов: "шампиньоны",

  макарон: "макароны",
  макаронами: "макароны",
  спагетти: "макароны",
  паста: "макароны",

  капусты: "капуста",
  капустой: "капуста",

  кабачки: "кабачок",
  кабачков: "кабачок",

  рыбу: "рыба",
  рыбы: "рыба",
  рыбой: "рыба",

  колбасу: "колбаса",
  колбасы: "колбаса",

  сосиска: "сосиски",
  сосисок: "сосиски",

  риса: "рис",
  рисом: "рис",

  гречки: "гречка",
  гречкой: "гречка",

  огурец: "огурцы",
  огурца: "огурцы",
  огурцов: "огурцы",

  перца: "перец",
  перцем: "перец"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/setup") {
      return setupWebhook(url, env);
    }

    if (url.pathname === "/status") {
      try {
        const store = getRecipeStore(env);
        const count = await store.getCount();

        return Response.json({
          ok: true,
          bot: "RadarFridge",
          source: `@${CHANNEL_USERNAME}`,
          stored_recipes: count,
          storage: "durable-object-sqlite"
        });
      } catch (error) {
        console.error("Status error:", error);

        return Response.json(
          {
            ok: false,
            error: String(error?.message || error)
          },
          {
            status: 500
          }
        );
      }
    }

    if (
      url.pathname === "/webhook" &&
      request.method === "POST"
    ) {
      try {
        const update = await request.json();

        const task = handleUpdate(update, env);

        if (ctx?.waitUntil) {
          ctx.waitUntil(task);
        } else {
          await task;
        }
      } catch (error) {
        console.error("Webhook error:", error);
      }

      return new Response("ok");
    }

    return new Response(
      [
        "🥕 RadarFridge работает.",
        `Источник: @${CHANNEL_USERNAME}`,
        "Хранилище: Durable Object SQLite",
        "",
        "Проверка:",
        `${url.origin}/status`
      ].join("\n"),
      {
        headers: {
          "content-type": "text/plain; charset=UTF-8"
        }
      }
    );
  }
};

export class RecipeStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);

    this.sql = ctx.storage.sql;

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS recipes (
        message_id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        url TEXT NOT NULL,
        published_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recipes_published_at
      ON recipes(published_at DESC);
    `);
  }

  async saveRecipe(recipe) {
    this.sql.exec(
      `
        INSERT INTO recipes (
          message_id,
          title,
          text,
          url,
          published_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(message_id) DO UPDATE SET
          title = excluded.title,
          text = excluded.text,
          url = excluded.url,
          published_at = excluded.published_at,
          updated_at = excluded.updated_at
      `,
      recipe.messageId,
      recipe.title,
      recipe.text,
      recipe.url,
      recipe.publishedAt,
      Date.now()
    );

    this.sql.exec(
      `
        DELETE FROM recipes
        WHERE message_id NOT IN (
          SELECT message_id
          FROM recipes
          ORDER BY published_at DESC, message_id DESC
          LIMIT ?
        )
      `,
      MAX_RECIPES
    );

    return {
      ok: true,
      count: await this.getCount()
    };
  }

  async getCount() {
    const rows = this.sql
      .exec(
        `
          SELECT COUNT(*) AS count
          FROM recipes
        `
      )
      .toArray();

    return Number(rows[0]?.count || 0);
  }

  async searchRecipes(ingredients, limit = 5) {
    const rows = this.sql
      .exec(
        `
          SELECT
            message_id,
            title,
            text,
            url,
            published_at
          FROM recipes
          ORDER BY published_at DESC, message_id DESC
          LIMIT ?
        `,
        MAX_RECIPES
      )
      .toArray();

    const recipes = rows
      .map((row) => {
        const matchedIngredients =
          findMatchedIngredients(
            row.text,
            ingredients
          );

        return {
          id: String(row.message_id),
          messageId: Number(row.message_id),
          title: row.title,
          text: row.text,
          url: row.url,
          publishedAt: Number(
            row.published_at
          ),
          matchedIngredients,
          score: calculateRecipeScore(
            row.text,
            matchedIngredients,
            ingredients
          )
        };
      })
      .filter((recipe) => {
        return (
          recipe.matchedIngredients.length > 0
        );
      })
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return b.messageId - a.messageId;
      });

    return recipes.slice(0, limit);
  }

  async clearRecipes() {
    this.sql.exec("DELETE FROM recipes");

    return {
      ok: true,
      count: 0
    };
  }
}

async function setupWebhook(url, env) {
  if (!env.BOT_TOKEN || !env.SETUP_SECRET) {
    return new Response(
      "Не настроены BOT_TOKEN или SETUP_SECRET",
      {
        status: 500
      }
    );
  }

  const receivedSecret =
    url.searchParams.get("secret");

  if (receivedSecret !== env.SETUP_SECRET) {
    return new Response("Доступ запрещён", {
      status: 403
    });
  }

  const webhookUrl = `${url.origin}/webhook`;

  const result = await telegramApi(
    env.BOT_TOKEN,
    "setWebhook",
    {
      url: webhookUrl,
      allowed_updates: [
        "message",
        "channel_post",
        "edited_channel_post"
      ],
      drop_pending_updates: false
    }
  );

  return Response.json(result);
}

async function handleUpdate(update, env) {
  console.log(
    "Telegram update:",
    JSON.stringify(update)
  );

  const channelMessage =
    update?.channel_post ||
    update?.edited_channel_post;

  if (channelMessage) {
    await saveChannelPost(
      channelMessage,
      env
    );

    return;
  }

  const message = update?.message;

  if (!message?.chat?.id) {
    return;
  }

  if (
    message.chat.type &&
    message.chat.type !== "private"
  ) {
    return;
  }

  const chatId = message.chat.id;

  const text = String(
    message.text ||
    message.caption ||
    ""
  ).trim();

  const command = getCommand(text);

  if (command === "/start") {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "🥕 Привет! Я RadarFridge.",
        "",
        "Напиши продукты, которые есть дома.",
        "",
        "Например:",
        "курица, картошка, сыр, лук",
        "",
        `Я найду подходящие рецепты в канале @${CHANNEL_USERNAME}.`,
        "",
        "Команда /status покажет количество сохранённых рецептов."
      ].join("\n")
    );

    return;
  }

  if (command === "/help") {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "ℹ️ Как пользоваться:",
        "",
        "Напиши продукты через запятую.",
        "",
        "Пример:",
        "фарш, картошка, сыр",
        "",
        "Команды:",
        "/start — начало",
        "/status — количество рецептов",
        "/sources — источник рецептов"
      ].join("\n")
    );

    return;
  }

  if (command === "/sources") {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "📡 Источник рецептов:",
        "",
        `@${CHANNEL_USERNAME}`,
        `https://t.me/${CHANNEL_USERNAME}`
      ].join("\n")
    );

    return;
  }

  if (command === "/status") {
    const store = getRecipeStore(env);
    const count = await store.getCount();

    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "📊 Состояние RadarFridge:",
        "",
        `Сохранено рецептов: ${count}`,
        `Максимум: ${MAX_RECIPES}`,
        "Хранилище: Durable Object SQLite"
      ].join("\n")
    );

    return;
  }

  if (!text || text.startsWith("/")) {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "Напиши продукты через запятую.",
        "",
        "Например:",
        "курица, картошка, сыр"
      ].join("\n")
    );

    return;
  }

  const ingredients =
    parseIngredients(text);

  if (ingredients.length === 0) {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      "Не удалось распознать продукты."
    );

    return;
  }

  await sendChatAction(
    env.BOT_TOKEN,
    chatId,
    "typing"
  );

  try {
    const store = getRecipeStore(env);

    const count = await store.getCount();

    if (count === 0) {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        [
          "📭 В базе пока нет рецептов.",
          "",
          `Опубликуй новый пост в канале @${CHANNEL_USERNAME}.`,
          "",
          "После этого повтори запрос."
        ].join("\n")
      );

      return;
    }

    const recipes =
      await store.searchRecipes(
        ingredients,
        5
      );

    if (recipes.length === 0) {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        [
          "Подходящих рецептов не нашлось.",
          "",
          `🥕 Запрос: ${ingredients.join(", ")}`,
          `📚 Проверено рецептов: ${count}`,
          "",
          "Попробуй убрать один продукт или написать другое название."
        ].join("\n")
      );

      return;
    }

    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        `🍽 Найдено рецептов: ${recipes.length}`,
        "",
        `🥕 По продуктам: ${ingredients.join(", ")}`,
        `📚 Рецептов в базе: ${count}`,
        "",
        "Лучшие варианты 👇"
      ].join("\n")
    );

    for (
      let index = 0;
      index < recipes.length;
      index++
    ) {
      await sendRecipe(
        env.BOT_TOKEN,
        chatId,
        recipes[index],
        index + 1
      );

      await sleep(200);
    }
  } catch (error) {
    console.error("Search error:", error);

    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "⚠️ Во время поиска произошла ошибка.",
        "",
        "Попробуй повторить запрос."
      ].join("\n")
    );
  }
}

async function saveChannelPost(
  message,
  env
) {
  const text = String(
    message.text ||
    message.caption ||
    ""
  ).trim();

  if (!text) {
    console.log(
      "Channel post ignored: no text"
    );

    return;
  }

  const username =
    message.chat?.username ||
    CHANNEL_USERNAME;

  if (
    message.chat?.username &&
    message.chat.username.toLowerCase() !==
      CHANNEL_USERNAME.toLowerCase()
  ) {
    console.log(
      `Ignored channel: @${message.chat.username}`
    );

    return;
  }

  const recipe = {
    messageId: Number(message.message_id),
    title: extractPostTitle(text),
    text,
    url: `https://t.me/${username}/${message.message_id}`,
    publishedAt:
      Number(message.date || 0) * 1000 ||
      Date.now()
  };

  const store = getRecipeStore(env);

  const result =
    await store.saveRecipe(recipe);

  console.log(
    "Recipe saved:",
    JSON.stringify(result)
  );
}

function getRecipeStore(env) {
  if (!env.RECIPE_STORE) {
    throw new Error(
      "RECIPE_STORE binding is missing"
    );
  }

  return env.RECIPE_STORE.getByName(
    "food-radar-daily"
  );
}

function parseIngredients(text) {
  const cleaned = String(text)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(
      /у меня есть|в холодильнике есть|в холодильнике|что приготовить из|приготовить из|что можно приготовить|можно приготовить|осталось|остались|продукты|ингредиенты|есть/gi,
      ""
    )
    .replace(/[.;\n/|+]+/g, ",")
    .replace(/\s+и\s+/g, ",");

  let parts = cleaned
    .split(",")
    .map(normalizeIngredient)
    .filter(Boolean);

  if (
    parts.length === 1 &&
    !cleaned.includes(",")
  ) {
    const words = cleaned
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (
      words.length >= 2 &&
      words.length <= 8
    ) {
      parts = words
        .map(normalizeIngredient)
        .filter(Boolean);
    }
  }

  return [...new Set(parts)].slice(0, 12);
}

function normalizeIngredient(value) {
  const cleaned = String(value)
    .trim()
    .replace(
      /^(немного|один|одна|одно|два|две|три|четыре|пять|кусок|кусочка|пачка|банка|бутылка|килограмм|килограмма|грамм|грамма|полкило)\s+/,
      ""
    )
    .replace(/\s+/g, " ");

  if (!cleaned) {
    return "";
  }

  const compact =
    cleaned.replace(/\s/g, "");

  return (
    INGREDIENT_ALIASES[cleaned] ||
    INGREDIENT_ALIASES[compact] ||
    cleaned
  );
}

function findMatchedIngredients(
  text,
  ingredients
) {
  const normalizedText =
    normalizeSearchText(text);

  return ingredients.filter(
    (ingredient) => {
      const normalizedIngredient =
        normalizeSearchText(ingredient);

      if (!normalizedIngredient) {
        return false;
      }

      if (
        normalizedText.includes(
          normalizedIngredient
        )
      ) {
        return true;
      }

      const words =
        normalizedIngredient
          .split(" ")
          .filter(Boolean);

      return words.every((word) => {
        const root =
          getIngredientRoot(word);

        return (
          root.length >= 4 &&
          normalizedText.includes(root)
        );
      });
    }
  );
}

function calculateRecipeScore(
  text,
  matchedIngredients,
  allIngredients
) {
  const normalizedText =
    normalizeSearchText(text);

  let score =
    matchedIngredients.length * 30;

  const coverage =
    matchedIngredients.length /
    Math.max(1, allIngredients.length);

  score += Math.round(coverage * 30);

  if (
    matchedIngredients.length ===
    allIngredients.length
  ) {
    score += 40;
  }

  const recipeWords = [
    "рецепт",
    "ингредиенты",
    "приготовление",
    "готовим",
    "готовить",
    "минут",
    "грамм",
    "столов",
    "чайная ложка",
    "духовк",
    "сковород"
  ];

  for (const word of recipeWords) {
    if (
      normalizedText.includes(
        normalizeSearchText(word)
      )
    ) {
      score += 4;
    }
  }

  if (text.length >= 150) {
    score += 5;
  }

  if (text.length >= 400) {
    score += 5;
  }

  return score;
}

function extractPostTitle(text) {
  const lines = String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "Рецепт";
  }

  const firstLine = lines[0]
    .replace(/^#+\s*/, "")
    .replace(
      /^[🍽🥗🥘🍲🍳🥣🥩🍗🐟🥧🍰🥞🥪🌮🍝🥕🔥✅⭐️✨]+\s*/u,
      ""
    )
    .trim();

  return limitText(
    firstLine || "Рецепт",
    120
  );
}

function getIngredientRoot(word) {
  const normalized =
    normalizeSearchText(word);

  if (normalized.length <= 5) {
    return normalized;
  }

  const endings = [
    "иями",
    "ами",
    "ями",
    "ого",
    "ему",
    "ому",
    "ыми",
    "ими",
    "ов",
    "ев",
    "ей",
    "ах",
    "ях",
    "ам",
    "ям",
    "ом",
    "ем",
    "ой",
    "ий",
    "ый",
    "ая",
    "яя",
    "ое",
    "ее",
    "а",
    "я",
    "ы",
    "и",
    "у",
    "ю",
    "е"
  ];

  for (const ending of endings) {
    if (
      normalized.endsWith(ending) &&
      normalized.length -
        ending.length >=
        4
    ) {
      return normalized.slice(
        0,
        -ending.length
      );
    }
  }

  return normalized.slice(
    0,
    Math.max(
      4,
      normalized.length - 2
    )
  );
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(
      /[^а-яa-z0-9\s]/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

async function sendRecipe(
  botToken,
  chatId,
  recipe,
  number
) {
  const matchedText =
    recipe.matchedIngredients.length > 0
      ? recipe.matchedIngredients.join(", ")
      : "совпадение по запросу";

  const description =
    limitText(recipe.text, 1000);

  const message = [
    `${number}️⃣ ${escapeHtml(recipe.title)}`,
    "",
    `🥕 Совпало: ${escapeHtml(matchedText)}`,
    "",
    escapeHtml(description),
    "",
    `🔗 <a href="${escapeHtmlAttribute(recipe.url)}">Открыть публикацию</a>`
  ].join("\n");

  return telegramApi(
    botToken,
    "sendMessage",
    {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: false,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🍽 Открыть рецепт",
              url: recipe.url
            }
          ]
        ]
      }
    }
  );
}

function getCommand(text) {
  if (!text.startsWith("/")) {
    return "";
  }

  return text
    .split(/\s+/)[0]
    .split("@")[0]
    .toLowerCase();
}

async function sendMessage(
  botToken,
  chatId,
  text
) {
  return telegramApi(
    botToken,
    "sendMessage",
    {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    }
  );
}

async function sendChatAction(
  botToken,
  chatId,
  action
) {
  return telegramApi(
    botToken,
    "sendChatAction",
    {
      chat_id: chatId,
      action
    }
  );
}

async function telegramApi(
  botToken,
  method,
  payload
) {
  if (!botToken) {
    throw new Error(
      "BOT_TOKEN is not configured"
    );
  }

  const response =
    await fetchWithTimeout(
      `${TELEGRAM_API}/bot${botToken}/${method}`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json"
        },
        body: JSON.stringify(payload)
      },
      10000
    );

  const result = await response.json();

  if (!result.ok) {
    console.error(
      "Telegram API error:",
      JSON.stringify(result)
    );
  }

  return result;
}

async function fetchWithTimeout(
  url,
  options,
  timeoutMilliseconds
) {
  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMilliseconds);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value)
    .replace(/'/g, "&#39;");
}

function limitText(
  value,
  maximumLength
) {
  const text = String(
    value || ""
  ).trim();

  if (
    text.length <= maximumLength
  ) {
    return text;
  }

  return `${text
    .slice(
      0,
      maximumLength - 1
    )
    .trim()}…`;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(
      resolve,
      milliseconds
    );
  });
}
