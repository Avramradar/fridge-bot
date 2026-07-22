const TELEGRAM_API = "https://api.telegram.org";
const MEALDB_API = "https://www.themealdb.com/api/json/v1/1";

const INGREDIENT_TRANSLATIONS = {
  фарш: "minced beef",
  говядина: "beef",
  свинина: "pork",
  курица: "chicken",
  индейка: "turkey",
  рыба: "fish",
  лосось: "salmon",
  тунец: "tuna",
  картошка: "potato",
  картофель: "potato",
  помидор: "tomato",
  помидоры: "tomato",
  томат: "tomato",
  лук: "onion",
  чеснок: "garlic",
  морковь: "carrot",
  капуста: "cabbage",
  грибы: "mushrooms",
  гриб: "mushrooms",
  сыр: "cheese",
  яйцо: "egg",
  яйца: "egg",
  молоко: "milk",
  сливки: "cream",
  сметана: "sour cream",
  масло: "butter",
  рис: "rice",
  макароны: "pasta",
  спагетти: "spaghetti",
  хлеб: "bread",
  фасоль: "beans",
  горох: "peas",
  кукуруза: "corn",
  перец: "pepper",
  кабачок: "courgettes",
  баклажан: "aubergine",
  огурец: "cucumber",
  яблоко: "apple",
  банан: "banana"
};

const TITLE_TRANSLATIONS = {
  chicken: "Курица",
  beef: "Говядина",
  pork: "Свинина",
  fish: "Рыба",
  potato: "Картофель",
  rice: "Рис",
  pasta: "Паста",
  soup: "Суп",
  salad: "Салат",
  pie: "Пирог",
  curry: "Карри",
  stew: "Рагу",
  cake: "Пирог",
  bread: "Хлеб"
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
        await handleUpdate(update, env);
      } catch (error) {
        console.error("Webhook error:", error);
      }

      return new Response("ok");
    }

    return new Response("🥕 FRIDGE BOT работает!", {
      headers: {
        "content-type": "text/plain; charset=UTF-8"
      }
    });
  }
};

async function setupWebhook(url, env) {
  if (url.searchParams.get("secret") !== env.SETUP_SECRET) {
    return new Response("Доступ запрещён", { status: 403 });
  }

  const webhookUrl = `${url.origin}/webhook`;

  const result = await telegramApi(env.BOT_TOKEN, "setWebhook", {
    url: webhookUrl
  });

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
        "🥕 Привет! Я найду рецепты в интернете.",
        "",
        "Напиши продукты через запятую.",
        "",
        "Например:",
        "курица, картошка, сыр, помидоры",
        "",
        "Я подберу до 5 подходящих рецептов."
      ].join("\n")
    );
    return;
  }

  if (!text || text.startsWith("/")) {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      "Напиши продукты через запятую, например:\nкурица, рис, лук, помидоры"
    );
    return;
  }

  await sendMessage(
    env.BOT_TOKEN,
    chatId,
    "🔎 Ищу подходящие рецепты в интернете..."
  );

  try {
    const ingredients = parseIngredients(text);

    if (ingredients.length === 0) {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "Не получилось распознать продукты. Напиши их через запятую."
      );
      return;
    }

    const meals = await findMealsByIngredients(ingredients);

    if (meals.length === 0) {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        [
          "😕 Подходящих рецептов пока не найдено.",
          "",
          "Попробуй указать основной продукт первым.",
          "Например: курица, картошка, сыр"
        ].join("\n")
      );
      return;
    }

    await sendRecipeResults(
      env.BOT_TOKEN,
      chatId,
      meals,
      ingredients
    );
  } catch (error) {
    console.error("Recipe search error:", error);

    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      "⚠️ Не удалось получить рецепты. Попробуй ещё раз через несколько секунд."
    );
  }
}

function parseIngredients(text) {
  const cleaned = text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(
      /у меня есть|в холодильнике есть|в холодильнике|есть продукты|из продуктов|приготовить из/gi,
      ""
    )
    .replace(/[.;\n/|]+/g, ",");

  return [
    ...new Set(
      cleaned
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map(translateIngredient)
    )
  ].slice(0, 10);
}

function translateIngredient(ingredient) {
  const normalized = ingredient
    .replace(/^(немного|есть|остался|остались)\s+/i, "")
    .trim();

  return INGREDIENT_TRANSLATIONS[normalized] || normalized;
}

async function findMealsByIngredients(ingredients) {
  const mealScores = new Map();

  for (const ingredient of ingredients.slice(0, 5)) {
    const meals = await filterMealsByIngredient(ingredient);

    for (const meal of meals) {
      const current = mealScores.get(meal.idMeal) || {
        ...meal,
        matchCount: 0
      };

      current.matchCount += 1;
      mealScores.set(meal.idMeal, current);
    }
  }

  const rankedMeals = [...mealScores.values()]
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 5);

  const detailedMeals = [];

  for (const meal of rankedMeals) {
    const details = await lookupMeal(meal.idMeal);

    if (details) {
      detailedMeals.push({
        ...details,
        matchCount: meal.matchCount
      });
    }
  }

  return detailedMeals;
}

async function filterMealsByIngredient(ingredient) {
  const url =
    `${MEALDB_API}/filter.php?i=${encodeURIComponent(ingredient)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`MealDB filter error: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.meals) ? data.meals : [];
}

async function lookupMeal(id) {
  const response = await fetch(
    `${MEALDB_API}/lookup.php?i=${encodeURIComponent(id)}`
  );

  if (!response.ok) {
    throw new Error(`MealDB lookup error: ${response.status}`);
  }

  const data = await response.json();
  return data.meals?.[0] || null;
}

async function sendRecipeResults(
  botToken,
  chatId,
  meals,
  ingredients
) {
  await sendMessage(
    botToken,
    chatId,
    [
      `🍽 Нашёл рецептов: ${meals.length}`,
      "",
      `По продуктам: ${ingredients.join(", ")}`,
      "",
      "Отправляю лучшие варианты 👇"
    ].join("\n")
  );

  for (let index = 0; index < meals.length; index++) {
    const meal = meals[index];
    const caption = buildRecipeCaption(meal, index + 1);

    if (meal.strMealThumb) {
      await sendPhoto(
        botToken,
        chatId,
        meal.strMealThumb,
        caption
      );
    } else {
      await sendMessage(botToken, chatId, caption);
    }
  }
}

function buildRecipeCaption(meal, number) {
  const ingredients = extractMealIngredients(meal);
  const title = translateTitle(meal.strMeal || "Рецепт");

  const sourceUrl =
    meal.strSource ||
    `https://www.themealdb.com/meal/${meal.idMeal}`;

  const lines = [
    `${number}️⃣ ${title}`,
    "",
    `🌍 Кухня: ${meal.strArea || "международная"}`,
    `📂 Категория: ${meal.strCategory || "блюдо"}`,
    `✅ Совпало продуктов: ${meal.matchCount}`,
    "",
    "🥕 Ингредиенты:",
    ...ingredients.slice(0, 12).map((item) => `• ${item}`),
    "",
    `🔗 Оригинальный рецепт: ${sourceUrl}`
  ];

  if (meal.strYoutube) {
    lines.push(`🎥 Видео: ${meal.strYoutube}`);
  }

  return lines.join("\n").slice(0, 1024);
}

function extractMealIngredients(meal) {
  const ingredients = [];

  for (let index = 1; index <= 20; index++) {
    const ingredient = String(
      meal[`strIngredient${index}`] || ""
    ).trim();

    const measure = String(
      meal[`strMeasure${index}`] || ""
    ).trim();

    if (ingredient) {
      ingredients.push(
        measure ? `${ingredient} — ${measure}` : ingredient
      );
    }
  }

  return ingredients;
}

function translateTitle(title) {
  let translated = title;

  for (const [english, russian] of Object.entries(TITLE_TRANSLATIONS)) {
    translated = translated.replace(
      new RegExp(`\\b${english}\\b`, "gi"),
      russian
    );
  }

  return translated;
}

async function sendMessage(botToken, chatId, text) {
  return telegramApi(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true
  });
}

async function sendPhoto(botToken, chatId, photo, caption) {
  return telegramApi(botToken, "sendPhoto", {
    chat_id: chatId,
    photo,
    caption
  });
}

async function telegramApi(botToken, method, payload) {
  const response = await fetch(
    `${TELEGRAM_API}/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    console.error("Telegram API error:", result);
  }

  return result;
}
