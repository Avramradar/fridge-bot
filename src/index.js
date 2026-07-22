const TELEGRAM_API = "https://api.telegram.org";

const RECIPE_SOURCES = [
  {
    name: "RussianFood",
    domain: "russianfood.com"
  },
  {
    name: "Поварёнок",
    domain: "povarenok.ru"
  },
  {
    name: "Аймкук",
    domain: "iamcook.ru"
  },
  {
    name: "1000.menu",
    domain: "1000.menu"
  },
  {
    name: "Едим Дома",
    domain: "edimdoma.ru"
  },
  {
    name: "Гастроном",
    domain: "gastronom.ru"
  },
  {
    name: "Лайфхакер",
    domain: "lifehacker.ru"
  },
  {
    name: "Меню недели",
    domain: "menunedeli.ru"
  },
  {
    name: "Koolinar",
    domain: "koolinar.ru"
  },
  {
    name: "Готовим дома",
    domain: "gotovim-doma.ru"
  }
];

const INGREDIENT_ALIASES = {
  картошка: "картофель",
  картошку: "картофель",
  картошки: "картофель",
  картофеля: "картофель",

  помидор: "помидоры",
  помидора: "помидоры",
  томат: "помидоры",
  томаты: "помидоры",

  яйцо: "яйца",
  яиц: "яйца",

  курицу: "курица",
  курицы: "курица",
  куриное: "курица",
  грудка: "куриное филе",
  грудку: "куриное филе",

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
  шампиньон: "шампиньоны",
  шампиньоны: "шампиньоны",

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
  рыбноефиле: "рыбное филе",

  колбасу: "колбаса",
  колбасы: "колбаса",

  сосиска: "сосиски",
  сосисок: "сосиски"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/setup") {
      return setupWebhook(url, env);
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
      try {
        const update = await request.json();

        /*
         * Возвращаем Telegram ответ сразу,
         * а обработку продолжаем в фоне.
         */
        const task = handleUpdate(update, env);

        if (typeof globalThis.waitUntil === "function") {
          globalThis.waitUntil(task);
        } else {
          await task;
        }
      } catch (error) {
        console.error("Webhook error:", error);
      }

      return new Response("ok");
    }

    return new Response(
      "🥕 RadarFridge работает. Поиск русскоязычных рецептов включён.",
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

  if (url.searchParams.get("secret") !== env.SETUP_SECRET) {
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
      allowed_updates: ["message"]
    }
  );

  return Response.json(result);
}

async function handleUpdate(update, env) {
  const message = update?.message;

  if (!message?.chat?.id) {
    return;
  }

  const chatId = message.chat.id;
  const text = String(message.text || "").trim();

  if (text === "/start") {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "🥕 Привет! Я RadarFridge.",
        "",
        "Напиши продукты, которые есть у тебя дома.",
        "",
        "Например:",
        "курица, картошка, сыр, лук, помидоры",
        "",
        "Я найду в интернете 3–5 рецептов на русском языке."
      ].join("\n")
    );

    return;
  }

  if (text === "/sources") {
    const sourceNames = RECIPE_SOURCES
      .map((source, index) => {
        return `${index + 1}. ${source.name}`;
      })
      .join("\n");

    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "🌐 Источники рецептов:",
        "",
        sourceNames
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

  const searchMessage = await sendMessage(
    env.BOT_TOKEN,
    chatId,
    [
      "🔎 Ищу рецепты в русскоязычных источниках...",
      "",
      `🥕 Продукты: ${ingredients.join(", ")}`
    ].join("\n")
  );

  try {
    const recipes = await searchRussianRecipes(ingredients);

    if (recipes.length === 0) {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        buildFallbackMessage(ingredients)
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
        "",
        "Лучшие варианты 👇"
      ].join("\n")
    );

    for (let index = 0; index < recipes.length; index++) {
      const recipe = recipes[index];

      await sendRecipe(
        env.BOT_TOKEN,
        chatId,
        recipe,
        index + 1,
        ingredients
      );

      /*
       * Небольшая задержка, чтобы Telegram
       * не отклонил сообщения из-за частоты.
       */
      await sleep(250);
    }
  } catch (error) {
    console.error("Search error:", error);

    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "⚠️ Сейчас интернет-поиск не ответил.",
        "",
        "Попробуй ещё раз через несколько секунд.",
        "",
        buildFallbackMessage(ingredients)
      ].join("\n")
    );
  }
}

function parseIngredients(text) {
  const cleaned = text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(
      /у меня есть|в холодильнике есть|в холодильнике|что приготовить из|приготовить из|что можно приготовить|осталось|остались|продукты|есть/gi,
      ""
    )
    .replace(/[.;\n/|]+/g, ",");

  const parts = cleaned
    .split(",")
    .flatMap((part) => {
      /*
       * Если пользователь написал продукты
       * через пробелы без запятых, сохраняем
       * фразу целиком, а не разбиваем мясное
       * или составное название.
       */
      return [part];
    })
    .map(normalizeIngredient)
    .filter(Boolean);

  return [...new Set(parts)].slice(0, 12);
}

function normalizeIngredient(value) {
  const cleaned = value
    .trim()
    .replace(
      /^(немного|один|одна|одно|два|две|три|кусок|кусочка|пачка|банка|бутылка|килограмм|грамм)\s+/,
      ""
    )
    .replace(/\s+/g, " ");

  const compact = cleaned.replace(/\s/g, "");

  return (
    INGREDIENT_ALIASES[cleaned] ||
    INGREDIENT_ALIASES[compact] ||
    cleaned
  );
}

async function searchRussianRecipes(ingredients) {
  const ingredientText = ingredients.join(" ");

  /*
   * Запрашиваем несколько вариантов поиска.
   * Каждый запрос ограничен русскоязычными
   * кулинарными сайтами.
   */
  const queries = [
    buildSearchQuery(ingredientText, [
      "russianfood.com",
      "povarenok.ru",
      "iamcook.ru"
    ]),
    buildSearchQuery(ingredientText, [
      "1000.menu",
      "edimdoma.ru",
      "gastronom.ru"
    ]),
    buildSearchQuery(ingredientText, [
      "menunedeli.ru",
      "koolinar.ru",
      "gotovim-doma.ru",
      "lifehacker.ru"
    ])
  ];

  const responses = await Promise.allSettled(
    queries.map((query) => searchDuckDuckGo(query))
  );

  const allResults = [];

  for (const response of responses) {
    if (response.status === "fulfilled") {
      allResults.push(...response.value);
    }
  }

  const filtered = allResults
    .filter((item) => isAllowedRecipeUrl(item.url))
    .filter((item) => isProbablyRecipe(item))
    .map((item) => {
      const source = getSourceByUrl(item.url);
      const score = calculateResultScore(
        item,
        ingredients,
        source
      );

      return {
        ...item,
        source: source?.name || getHostname(item.url),
        score
      };
    });

  const unique = removeDuplicates(filtered);

  return unique
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function buildSearchQuery(ingredientText, domains) {
  const sites = domains
    .map((domain) => `site:${domain}`)
    .join(" OR ");

  return [
    `"рецепт"`,
    ingredientText,
    `(${sites})`,
    "-видео",
    "-форум"
  ].join(" ");
}

async function searchDuckDuckGo(query) {
  const url =
    "https://html.duckduckgo.com/html/?" +
    new URLSearchParams({
      q: query,
      kl: "ru-ru"
    }).toString();

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "ru-RU,ru;q=0.9"
      }
    },
    9000
  );

  if (!response.ok) {
    console.error(
      "Search HTTP error:",
      response.status
    );

    return [];
  }

  const html = await response.text();

  return parseDuckDuckGoResults(html);
}

function parseDuckDuckGoResults(html) {
  const results = [];

  /*
   * Получаем блоки поисковой выдачи.
   * Используются несколько шаблонов,
   * чтобы код переживал небольшие
   * изменения разметки.
   */
  const blockRegex =
    /<div[^>]+class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;

  let blockMatch;

  while (
    (blockMatch = blockRegex.exec(html)) !== null &&
    results.length < 15
  ) {
    const block = blockMatch[1];

    const linkMatch =
      block.match(
        /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
      ) ||
      block.match(
        /<a[^>]+href="([^"]+)"[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i
      );

    if (!linkMatch) {
      continue;
    }

    const rawUrl = decodeHtml(linkMatch[1]);
    const url = extractRealUrl(rawUrl);
    const title = cleanHtml(linkMatch[2]);

    const snippetMatch =
      block.match(
        /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i
      );

    const snippet = snippetMatch
      ? cleanHtml(snippetMatch[1])
      : "";

    if (!url || !title) {
      continue;
    }

    results.push({
      title,
      url,
      snippet
    });
  }

  /*
   * Запасной парсер — если основной шаблон
   * не нашёл результаты.
   */
  if (results.length === 0) {
    const linkRegex =
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

    let match;

    while (
      (match = linkRegex.exec(html)) !== null &&
      results.length < 15
    ) {
      const url = extractRealUrl(
        decodeHtml(match[1])
      );

      const title = cleanHtml(match[2]);

      if (url && title) {
        results.push({
          title,
          url,
          snippet: ""
        });
      }
    }
  }

  return results;
}

function extractRealUrl(rawUrl) {
  try {
    if (rawUrl.startsWith("//")) {
      rawUrl = `https:${rawUrl}`;
    }

    const parsed = new URL(
      rawUrl,
      "https://duckduckgo.com"
    );

    const redirectUrl =
      parsed.searchParams.get("uddg");

    if (redirectUrl) {
      return decodeURIComponent(redirectUrl);
    }

    if (
      parsed.hostname.includes("duckduckgo.com")
    ) {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

function isAllowedRecipeUrl(url) {
  try {
    const hostname = new URL(url)
      .hostname
      .replace(/^www\./, "");

    return RECIPE_SOURCES.some((source) => {
      return (
        hostname === source.domain ||
        hostname.endsWith(`.${source.domain}`)
      );
    });
  } catch {
    return false;
  }
}

function isProbablyRecipe(item) {
  const combined =
    `${item.title} ${item.snippet} ${item.url}`
      .toLowerCase();

  const badWords = [
    "форум",
    "профиль",
    "автор",
    "каталог ингредиентов",
    "статья",
    "новости",
    "правила сайта",
    "регистрация",
    "поиск рецептов"
  ];

  if (
    badWords.some((word) => combined.includes(word))
  ) {
    return false;
  }

  const goodWords = [
    "рецепт",
    "приготов",
    "ингредиент",
    "блюдо",
    "кухн",
    "/recipe",
    "/recipes",
    "/cooking",
    "/showrecipe"
  ];

  return goodWords.some((word) =>
    combined.includes(word)
  );
}

function calculateResultScore(
  item,
  ingredients,
  source
) {
  const text =
    `${item.title} ${item.snippet}`
      .toLowerCase()
      .replace(/ё/g, "е");

  let score = 0;

  for (const ingredient of ingredients) {
    const normalized = ingredient
      .toLowerCase()
      .replace(/ё/g, "е");

    if (text.includes(normalized)) {
      score += 20;
    } else {
      const root = normalized.slice(
        0,
        Math.max(4, normalized.length - 2)
      );

      if (
        root.length >= 4 &&
        text.includes(root)
      ) {
        score += 10;
      }
    }
  }

  if (text.includes("рецепт")) {
    score += 8;
  }

  if (text.includes("пошагов")) {
    score += 5;
  }

  if (text.includes("фото")) {
    score += 4;
  }

  /*
   * Небольшой приоритет крупным
   * специализированным каталогам.
   */
  const sourceBonus = {
    "RussianFood": 8,
    "Поварёнок": 8,
    "Аймкук": 8,
    "1000.menu": 7,
    "Едим Дома": 6,
    "Гастроном": 6,
    "Меню недели": 5,
    "Koolinar": 5,
    "Готовим дома": 5,
    "Лайфхакер": 3
  };

  score += sourceBonus[source?.name] || 0;

  return score;
}

function removeDuplicates(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const result = [];

  for (const item of items) {
    const normalizedUrl = normalizeUrl(item.url);
    const normalizedTitle = item.title
      .toLowerCase()
      .replace(/[^а-яa-z0-9]+/gi, " ")
      .trim();

    if (
      seenUrls.has(normalizedUrl) ||
      seenTitles.has(normalizedTitle)
    ) {
      continue;
    }

    seenUrls.add(normalizedUrl);
    seenTitles.add(normalizedTitle);
    result.push(item);
  }

  return result;
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);

    url.hash = "";

    const removableParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "from",
      "ref"
    ];

    for (const parameter of removableParams) {
      url.searchParams.delete(parameter);
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function getSourceByUrl(url) {
  try {
    const hostname = new URL(url)
      .hostname
      .replace(/^www\./, "");

    return RECIPE_SOURCES.find((source) => {
      return (
        hostname === source.domain ||
        hostname.endsWith(`.${source.domain}`)
      );
    });
  } catch {
    return null;
  }
}

function getHostname(url) {
  try {
    return new URL(url)
      .hostname
      .replace(/^www\./, "");
  } catch {
    return "Источник";
  }
}

async function sendRecipe(
  botToken,
  chatId,
  recipe,
  number,
  ingredients
) {
  const matched = ingredients.filter((ingredient) => {
    const text =
      `${recipe.title} ${recipe.snippet}`
        .toLowerCase()
        .replace(/ё/g, "е");

    const normalized = ingredient
      .toLowerCase()
      .replace(/ё/g, "е");

    const root = normalized.slice(
      0,
      Math.max(4, normalized.length - 2)
    );

    return (
      text.includes(normalized) ||
      (
        root.length >= 4 &&
        text.includes(root)
      )
    );
  });

  const matchText =
    matched.length > 0
      ? matched.join(", ")
      : "совпадение по запросу";

  const snippet = limitText(
    recipe.snippet ||
      "Открой рецепт, чтобы посмотреть ингредиенты и пошаговое приготовление.",
    500
  );

  const message = [
    `${number}️⃣ ${escapeHtml(recipe.title)}`,
    "",
    `🌐 Источник: ${escapeHtml(recipe.source)}`,
    `🥕 Совпало: ${escapeHtml(matchText)}`,
    "",
    escapeHtml(snippet),
    "",
    `🔗 <a href="${escapeHtmlAttribute(recipe.url)}">Открыть полный рецепт</a>`
  ].join("\n");

  await telegramApi(
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

function buildFallbackMessage(ingredients) {
  const query = encodeURIComponent(
    `${ingredients.join(" ")} рецепт`
  );

  const links = RECIPE_SOURCES
    .slice(0, 5)
    .map((source) => {
      const url =
        `https://www.google.com/search?q=` +
        encodeURIComponent(
          `site:${source.domain} ${ingredients.join(" ")} рецепт`
        );

      return `• <a href="${url}">${escapeHtml(source.name)}</a>`;
    })
    .join("\n");

  return [
    "Подходящие рецепты пока не удалось собрать автоматически.",
    "",
    "Можно открыть готовый поиск по источникам:",
    "",
    links
  ].join("\n");
}

async function sendMessage(botToken, chatId, text) {
  return telegramApi(
    botToken,
    "sendMessage",
    {
      chat_id: chatId,
      text,
      parse_mode: text.includes("<a href=")
        ? "HTML"
        : undefined,
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
  const response = await fetchWithTimeout(
    `${TELEGRAM_API}/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(
        removeUndefinedValues(payload)
      )
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

function removeUndefinedValues(object) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => value !== undefined
    )
  );
}

async function fetchWithTimeout(
  url,
  options,
  timeoutMilliseconds
) {
  const controller = new AbortController();

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

function cleanHtml(value) {
  return decodeHtml(
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x3D;/gi, "=");
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

function limitText(value, maximumLength) {
  const text = String(value || "").trim();

  if (text.length <= maximumLength) {
    return text;
  }

  return `${text.slice(0, maximumLength - 1).trim()}…`;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
