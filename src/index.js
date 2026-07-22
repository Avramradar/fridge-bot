const TELEGRAM_API = "https://api.telegram.org";
const CHANNEL_USERNAME = "FoodRadarDaily";
const MAX_MEMORY_RECIPES = 200;

/*
 * Временная память.
 * Очищается после перезапуска или нового деплоя Worker.
 */
const CHANNEL_RECIPES = [];

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
  яйцами: "яйца",

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

  рыбноефиле: "рыбное филе",

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
      return Response.json({
        ok: true,
        bot: "RadarFridge",
        source: `@${CHANNEL_USERNAME}`,
        stored_recipes: CHANNEL_RECIPES.length,
        storage: "temporary-memory"
      });
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

      /*
       * Telegram должен быстро получить ответ 200.
       */
      return new Response("ok");
    }

    return new Response(
      [
        "🥕 RadarFridge работает.",
        `Источник: @${CHANNEL_USERNAME}`,
        `Рецептов во временной памяти: ${CHANNEL_RECIPES.length}`
      ].join("\n"),
      {
        headers: {
          "content-type": "text/plain; charset=UTF-8"
        }
      }
    );
  }
};

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
  /*
   * Сохраняем новую или отредактированную
   * публикацию канала во временной памяти.
   */
  const channelMessage =
    update?.channel_post ||
    update?.edited_channel_post;

  if (channelMessage) {
    rememberChannelPost(channelMessage);
    return;
  }

  const message = update?.message;

  if (!message?.chat?.id) {
    return;
  }

  /*
   * Бот отвечает только в личном чате.
   */
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
        "Напиши продукты, которые есть у тебя дома.",
        "",
        "Например:",
        "курица, картошка, сыр, лук",
        "",
        `Я поищу подходящие рецепты среди новых публикаций канала @${CHANNEL_USERNAME}.`,
        "",
        "Команда /status покажет, сколько рецептов сейчас находится в памяти."
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
        `https://t.me/${CHANNEL_USERNAME}`,
        "",
        "Бот запоминает новые публикации канала после их получения."
      ].join("\n")
    );

    return;
  }

  if (command === "/status") {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "📊 Состояние RadarFridge:",
        "",
        `Сохранено рецептов: ${CHANNEL_RECIPES.length}`,
        `Максимум: ${MAX_MEMORY_RECIPES}`,
        "Хранилище: временная память Worker",
        "",
        CHANNEL_RECIPES.length === 0
          ? "Сейчас память пустая. Опубликуй новый пост в канале после установки webhook."
          : "Можно отправлять продукты для поиска."
      ].join("\n")
    );

    return;
  }

  if (command === "/help") {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "ℹ️ Как пользоваться ботом:",
        "",
        "1. Напиши продукты через запятую.",
        "2. Бот сравнит их с рецептами в памяти.",
        "3. Ты получишь ссылки на подходящие публикации.",
        "",
        "Пример:",
        "картошка, курица, сыр",
        "",
        "Команды:",
        "/start — начало",
        "/sources — источник",
        "/status — состояние памяти"
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
        "фарш, картошка, сыр, лук"
      ].join("\n")
    );

    return;
  }

  if (CHANNEL_RECIPES.length === 0) {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "📭 В памяти пока нет рецептов.",
        "",
        `Опубликуй новый рецепт в канале @${CHANNEL_USERNAME}.`,
        "",
        "Бот начнёт запоминать публикации только после подключения webhook.",
        "",
        "Проверить состояние можно командой /status."
      ].join("\n")
    );

    return;
  }

  const ingredients = parseIngredients(text);

  if (ingredients.length === 0) {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      "Не удалось распознать продукты. Напиши их через запятую."
    );

    return;
  }

  await sendChatAction(
    env.BOT_TOKEN,
    chatId,
    "typing"
  );

  try {
    const recipes =
      searchChannelRecipes(ingredients);

    if (recipes.length === 0) {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        [
          "Подходящих публикаций пока не нашлось.",
          "",
          `🥕 Запрос: ${ingredients.join(", ")}`,
          `📚 Проверено рецептов: ${CHANNEL_RECIPES.length}`,
          "",
          "Попробуй убрать один из продуктов или написать другое название."
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
        `📚 Рецептов в памяти: ${CHANNEL_RECIPES.length}`,
        "",
        "Лучшие варианты 👇"
      ].join("\n")
    );

    for (
      let index = 0;
      index < recipes.length;
      index++
    ) {
      await sendChannelRecipe(
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
        "Попробуй повторить запрос через несколько секунд."
      ].join("\n")
    );
  }
}

function rememberChannelPost(message) {
  const text = String(
    message.text ||
    message.caption ||
    ""
  ).trim();

  if (!text) {
    console.log(
      "Channel post ignored: no text or caption"
    );

    return;
  }

  const chatUsername =
    message.chat?.username ||
    CHANNEL_USERNAME;

  /*
   * Не запоминаем посты другого канала,
   * если webhook неожиданно получил их.
   */
  if (
    message.chat?.username &&
    message.chat.username.toLowerCase() !==
      CHANNEL_USERNAME.toLowerCase()
  ) {
    console.log(
      `Post ignored from channel: @${message.chat.username}`
    );

    return;
  }

  const id = String(message.message_id);

  const recipe = {
    id,
    messageId: message.message_id,
    title: extractPostTitle(text),
    text,
    url: `https://t.me/${chatUsername}/${id}`,
    publishedAt: message.date
      ? new Date(
          message.date * 1000
        ).toISOString()
      : ""
  };

  const existingIndex =
    CHANNEL_RECIPES.findIndex((item) => {
      return item.id === id;
    });

  if (existingIndex >= 0) {
    CHANNEL_RECIPES[existingIndex] = recipe;
  } else {
    CHANNEL_RECIPES.unshift(recipe);
  }

  if (
    CHANNEL_RECIPES.length >
    MAX_MEMORY_RECIPES
  ) {
    CHANNEL_RECIPES.length =
      MAX_MEMORY_RECIPES;
  }

  console.log(
    `Recipe remembered: ${id}. Total: ${CHANNEL_RECIPES.length}`
  );
}

function searchChannelRecipes(ingredients) {
  const recipes = CHANNEL_RECIPES
    .map((post) => {
      const matchedIngredients =
        findMatchedIngredients(
          post.text,
          ingredients
        );

      const score =
        calculateChannelPostScore(
          post.text,
          matchedIngredients,
          ingredients
        );

      return {
        ...post,
        matchedIngredients,
        score
      };
    })
    .filter((post) => {
      return (
        post.matchedIngredients.length > 0
      );
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        Number(b.messageId) -
        Number(a.messageId)
      );
    });

  return removeDuplicatePosts(recipes)
    .slice(0, 5);
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

  /*
   * Если пользователь написал короткий список
   * только через пробелы, пробуем разделить его.
   */
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

function calculateChannelPostScore(
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
    .map((line) => {
      return line.trim();
    })
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
      normalized.length - ending.length >= 4
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

function removeDuplicatePosts(posts) {
  const seenIds = new Set();
  const result = [];

  for (const post of posts) {
    if (seenIds.has(post.id)) {
      continue;
    }

    seenIds.add(post.id);
    result.push(post);
  }

  return result;
}

async function sendChannelRecipe(
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
    `🔗 <a href="${escapeHtmlAttribute(recipe.url)}">Открыть публикацию в канале</a>`
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
    console.error(
      "BOT_TOKEN is not configured"
    );

    return {
      ok: false,
      description:
        "BOT_TOKEN is not configured"
    };
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
        body: JSON.stringify(
          removeUndefinedValues(payload)
        )
      },
      10000
    );

  let result;

  try {
    result = await response.json();
  } catch {
    console.error(
      "Telegram API returned invalid JSON:",
      response.status
    );

    return {
      ok: false,
      error_code: response.status,
      description:
        "Invalid Telegram response"
    };
  }

  if (!result.ok) {
    console.error(
      "Telegram API error:",
      JSON.stringify(result)
    );
  }

  return result;
}

function removeUndefinedValues(object) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => {
        return value !== undefined;
      }
    )
  );
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
