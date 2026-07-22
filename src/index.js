const TELEGRAM_API = "https://api.telegram.org";

const RECIPES = [
  {
    id: "potato_meat_casserole",
    title: "Картофельная запеканка с фаршем",
    time: "55 минут",
    portions: "4 порции",
    ingredients: [
      "картофель",
      "фарш",
      "лук",
      "сыр",
      "помидоры"
    ],
    optional: ["сметана", "чеснок"],
    steps: [
      "Картофель очистите и нарежьте тонкими кружочками.",
      "Лук измельчите и обжарьте вместе с фаршем 8–10 минут.",
      "Выложите картофель, фарш и помидоры слоями.",
      "Посыпьте тёртым сыром.",
      "Запекайте при 190 °C около 40 минут."
    ]
  },
  {
    id: "fried_potatoes_meat",
    title: "Жареная картошка с фаршем",
    time: "35 минут",
    portions: "3 порции",
    ingredients: ["картофель", "фарш", "лук"],
    optional: ["чеснок", "зелень"],
    steps: [
      "Картофель нарежьте небольшими кусочками.",
      "Обжарьте фарш с луком.",
      "Добавьте картофель и перемешайте.",
      "Готовьте под крышкой около 20 минут.",
      "Добавьте соль, специи и зелень."
    ]
  },
  {
    id: "meatballs",
    title: "Домашние котлеты",
    time: "40 минут",
    portions: "4 порции",
    ingredients: ["фарш", "лук", "яйца", "хлеб"],
    optional: ["молоко", "чеснок"],
    steps: [
      "Хлеб замочите в молоке или воде.",
      "Смешайте фарш, лук, яйцо и отжатый хлеб.",
      "Добавьте соль и специи.",
      "Сформируйте котлеты.",
      "Обжарьте с двух сторон до готовности."
    ]
  },
  {
    id: "pasta_meat",
    title: "Макароны с фаршем по-домашнему",
    time: "30 минут",
    portions: "4 порции",
    ingredients: ["макароны", "фарш", "лук"],
    optional: ["помидоры", "сыр", "чеснок"],
    steps: [
      "Макароны отварите до готовности.",
      "Фарш обжарьте с измельчённым луком.",
      "При наличии добавьте помидоры или томатную пасту.",
      "Смешайте фарш с макаронами.",
      "Посыпьте сыром."
    ]
  },
  {
    id: "chicken_potatoes",
    title: "Курица с картофелем в духовке",
    time: "60 минут",
    portions: "4 порции",
    ingredients: ["курица", "картофель", "лук"],
    optional: ["чеснок", "сметана", "сыр"],
    steps: [
      "Картофель нарежьте крупными кусочками.",
      "Курицу натрите солью и специями.",
      "Добавьте нарезанный лук.",
      "Выложите всё в форму.",
      "Запекайте при 190 °C около 50 минут."
    ]
  },
  {
    id: "chicken_rice",
    title: "Рис с курицей",
    time: "45 минут",
    portions: "4 порции",
    ingredients: ["курица", "рис", "лук", "морковь"],
    optional: ["чеснок"],
    steps: [
      "Курицу нарежьте и слегка обжарьте.",
      "Добавьте лук и морковь.",
      "Всыпьте промытый рис.",
      "Добавьте воду в пропорции примерно 1 к 2.",
      "Готовьте под крышкой до мягкости риса."
    ]
  },
  {
    id: "chicken_pasta",
    title: "Макароны с курицей и сыром",
    time: "30 минут",
    portions: "3 порции",
    ingredients: ["курица", "макароны", "сыр"],
    optional: ["сливки", "лук", "чеснок"],
    steps: [
      "Макароны отварите.",
      "Курицу нарежьте и обжарьте.",
      "Добавьте сливки или немного воды.",
      "Смешайте с макаронами.",
      "Добавьте тёртый сыр."
    ]
  },
  {
    id: "omelette_cheese",
    title: "Омлет с сыром",
    time: "15 минут",
    portions: "2 порции",
    ingredients: ["яйца", "сыр"],
    optional: ["молоко", "помидоры", "зелень"],
    steps: [
      "Яйца взбейте с солью.",
      "При наличии добавьте немного молока.",
      "Вылейте смесь на разогретую сковороду.",
      "Добавьте сыр и помидоры.",
      "Готовьте под крышкой 5–7 минут."
    ]
  },
  {
    id: "tomato_eggs",
    title: "Яичница с помидорами",
    time: "15 минут",
    portions: "2 порции",
    ingredients: ["яйца", "помидоры"],
    optional: ["лук", "сыр", "зелень"],
    steps: [
      "Помидоры нарежьте и обжарьте 3–4 минуты.",
      "При наличии добавьте лук.",
      "Разбейте яйца на сковороду.",
      "Посолите и добавьте специи.",
      "Готовьте до желаемой степени прожарки."
    ]
  },
  {
    id: "hot_sandwiches",
    title: "Горячие бутерброды с сыром",
    time: "15 минут",
    portions: "2 порции",
    ingredients: ["хлеб", "сыр"],
    optional: ["колбаса", "помидоры", "ветчина"],
    steps: [
      "Хлеб выложите на противень.",
      "Добавьте колбасу, ветчину или помидоры.",
      "Посыпьте тёртым сыром.",
      "Запекайте при 190 °C около 8–10 минут."
    ]
  },
  {
    id: "potato_pancakes",
    title: "Картофельные драники",
    time: "35 минут",
    portions: "3 порции",
    ingredients: ["картофель", "лук", "яйца", "мука"],
    optional: ["сметана", "чеснок"],
    steps: [
      "Картофель и лук натрите на мелкой тёрке.",
      "Добавьте яйцо и муку.",
      "Посолите и перемешайте.",
      "Выкладывайте массу ложкой на сковороду.",
      "Обжарьте с двух сторон."
    ]
  },
  {
    id: "mashed_potatoes",
    title: "Картофельное пюре",
    time: "35 минут",
    portions: "4 порции",
    ingredients: ["картофель", "молоко", "масло"],
    optional: ["сыр", "зелень"],
    steps: [
      "Картофель очистите и отварите.",
      "Слейте воду.",
      "Добавьте тёплое молоко и масло.",
      "Разомните до однородности.",
      "Добавьте соль."
    ]
  },
  {
    id: "vegetable_stew",
    title: "Овощное рагу",
    time: "45 минут",
    portions: "4 порции",
    ingredients: [
      "картофель",
      "кабачок",
      "помидоры",
      "лук",
      "морковь"
    ],
    optional: ["перец", "чеснок", "капуста"],
    steps: [
      "Все овощи нарежьте кубиками.",
      "Обжарьте лук и морковь.",
      "Добавьте картофель и кабачок.",
      "Добавьте помидоры и немного воды.",
      "Тушите под крышкой около 30 минут."
    ]
  },
  {
    id: "rice_vegetables",
    title: "Рис с овощами",
    time: "35 минут",
    portions: "3 порции",
    ingredients: ["рис", "лук", "морковь"],
    optional: ["перец", "кукуруза", "горошек"],
    steps: [
      "Рис промойте.",
      "Лук и морковь обжарьте.",
      "Добавьте остальные овощи.",
      "Всыпьте рис и добавьте воду.",
      "Готовьте под крышкой до готовности."
    ]
  },
  {
    id: "mushroom_potatoes",
    title: "Жареная картошка с грибами",
    time: "40 минут",
    portions: "3 порции",
    ingredients: ["картофель", "грибы", "лук"],
    optional: ["сметана", "зелень"],
    steps: [
      "Картофель нарежьте ломтиками.",
      "Грибы и лук обжарьте отдельно.",
      "Картофель обжарьте до золотистой корочки.",
      "Добавьте грибы и лук.",
      "Готовьте вместе ещё 5–7 минут."
    ]
  },
  {
    id: "mushroom_pasta",
    title: "Макароны с грибами",
    time: "30 минут",
    portions: "3 порции",
    ingredients: ["макароны", "грибы", "лук"],
    optional: ["сливки", "сыр", "чеснок"],
    steps: [
      "Макароны отварите.",
      "Грибы обжарьте с луком.",
      "Добавьте сливки или немного воды.",
      "Смешайте с макаронами.",
      "Добавьте сыр."
    ]
  },
  {
    id: "fish_potatoes",
    title: "Рыба с картофелем в духовке",
    time: "50 минут",
    portions: "4 порции",
    ingredients: ["рыба", "картофель", "лук"],
    optional: ["сметана", "сыр", "лимон"],
    steps: [
      "Картофель нарежьте тонкими кружочками.",
      "Рыбу посолите и добавьте специи.",
      "Выложите картофель, лук и рыбу в форму.",
      "При наличии смажьте сметаной.",
      "Запекайте при 190 °C около 40 минут."
    ]
  },
  {
    id: "cabbage_stew",
    title: "Тушёная капуста",
    time: "45 минут",
    portions: "4 порции",
    ingredients: ["капуста", "лук", "морковь"],
    optional: ["помидоры", "фарш", "сосиски"],
    steps: [
      "Капусту нашинкуйте.",
      "Лук и морковь обжарьте.",
      "Добавьте капусту.",
      "Влейте немного воды.",
      "Тушите под крышкой около 30 минут."
    ]
  },
  {
    id: "cheese_pasta",
    title: "Макароны с сыром",
    time: "20 минут",
    portions: "2 порции",
    ingredients: ["макароны", "сыр"],
    optional: ["молоко", "масло", "сливки"],
    steps: [
      "Макароны отварите.",
      "Слейте воду.",
      "Добавьте масло или сливки.",
      "Всыпьте тёртый сыр.",
      "Перемешайте до расплавления сыра."
    ]
  },
  {
    id: "milk_pancakes",
    title: "Домашние блины",
    time: "35 минут",
    portions: "4 порции",
    ingredients: ["молоко", "яйца", "мука"],
    optional: ["сахар", "масло"],
    steps: [
      "Яйца взбейте с солью и сахаром.",
      "Добавьте молоко.",
      "Постепенно вмешайте муку.",
      "Добавьте немного масла.",
      "Обжарьте тонкие блины с двух сторон."
    ]
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
  грудка: "курица",
  филе: "курица",

  фарша: "фарш",
  мяснойфарш: "фарш",

  лука: "лук",
  моркови: "морковь",
  сыра: "сыр",

  гриб: "грибы",
  шампиньон: "грибы",
  шампиньоны: "грибы",

  макарон: "макароны",
  спагетти: "макароны",
  паста: "макароны",

  капусты: "капуста",
  кабачки: "кабачок",

  рыбноефиле: "рыба",
  рыбу: "рыба",

  колбасу: "колбаса",
  сосиска: "сосиски"
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

    return new Response("🥕 RadarFridge работает!", {
      headers: {
        "content-type": "text/plain; charset=UTF-8"
      }
    });
  }
};

async function setupWebhook(url, env) {
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
      url: webhookUrl
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
        "Напиши продукты, которые у тебя есть, через запятую.",
        "",
        "Например:",
        "курица, картошка, сыр, лук, помидоры",
        "",
        "Я сразу подберу от 3 до 5 рецептов на русском языке."
      ].join("\n")
    );

    return;
  }

  if (!text || text.startsWith("/")) {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      "Напиши продукты через запятую.\n\nНапример:\nфарш, картошка, сыр, лук"
    );

    return;
  }

  const userIngredients = parseIngredients(text);

  if (userIngredients.length === 0) {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      "Не получилось распознать продукты. Напиши их через запятую."
    );

    return;
  }

  const recipes = findBestRecipes(userIngredients);

  await sendMessage(
    env.BOT_TOKEN,
    chatId,
    [
      `🍽 Нашёл ${recipes.length} подходящих рецептов`,
      "",
      `🥕 Твои продукты: ${userIngredients.join(", ")}`,
      "",
      "Лучшие варианты 👇"
    ].join("\n")
  );

  for (let index = 0; index < recipes.length; index++) {
    const recipe = recipes[index];

    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      buildRecipeMessage(recipe, index + 1)
    );
  }
}

function parseIngredients(text) {
  const cleaned = text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(
      /у меня есть|в холодильнике есть|в холодильнике|что приготовить из|приготовить из|осталось|остались|есть/gi,
      ""
    )
    .replace(/[.;\n/|]+/g, ",");

  return [
    ...new Set(
      cleaned
        .split(",")
        .map((item) => normalizeIngredient(item))
        .filter(Boolean)
    )
  ].slice(0, 15);
}

function normalizeIngredient(value) {
  const cleaned = value
    .trim()
    .replace(
      /^(немного|один|одна|одно|два|две|кусок|пачка|банка)\s+/,
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

function findBestRecipes(userIngredients) {
  const rankedRecipes = RECIPES.map((recipe) => {
    const matchedIngredients = recipe.ingredients.filter(
      (ingredient) =>
        userIngredients.some((userIngredient) =>
          ingredientsMatch(userIngredient, ingredient)
        )
    );

    const matchedOptional = recipe.optional.filter(
      (ingredient) =>
        userIngredients.some((userIngredient) =>
          ingredientsMatch(userIngredient, ingredient)
        )
    );

    const missingIngredients = recipe.ingredients.filter(
      (ingredient) =>
        !matchedIngredients.includes(ingredient)
    );

    const matchRatio =
      matchedIngredients.length / recipe.ingredients.length;

    const score =
      matchedIngredients.length * 20 +
      matchedOptional.length * 5 +
      matchRatio * 20 -
      missingIngredients.length * 7;

    return {
      ...recipe,
      matchedIngredients,
      matchedOptional,
      missingIngredients,
      score
    };
  });

  let results = rankedRecipes
    .filter((recipe) => recipe.matchedIngredients.length > 0)
    .sort((a, b) => b.score - a.score);

  if (results.length >= 5) {
    return results.slice(0, 5);
  }

  if (results.length >= 3) {
    return results;
  }

  return rankedRecipes
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function ingredientsMatch(userIngredient, recipeIngredient) {
  const user = userIngredient.toLowerCase();
  const recipe = recipeIngredient.toLowerCase();

  return (
    user === recipe ||
    user.includes(recipe) ||
    recipe.includes(user)
  );
}

function buildRecipeMessage(recipe, number) {
  const availableText =
    recipe.matchedIngredients.length > 0
      ? recipe.matchedIngredients.join(", ")
      : "нет точных совпадений";

  const missingText =
    recipe.missingIngredients.length > 0
      ? recipe.missingIngredients.join(", ")
      : "ничего — все основные продукты есть";

  const optionalText =
    recipe.optional.length > 0
      ? recipe.optional.join(", ")
      : "не требуются";

  const stepsText = recipe.steps
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n");

  return [
    `${number}️⃣ ${recipe.title}`,
    "",
    `⏱ Время: ${recipe.time}`,
    `🍽 Количество: ${recipe.portions}`,
    "",
    `✅ Уже есть: ${availableText}`,
    `🛒 Не хватает: ${missingText}`,
    `➕ По желанию: ${optionalText}`,
    "",
    "👨‍🍳 Приготовление:",
    stepsText
  ].join("\n");
}

async function sendMessage(botToken, chatId, text) {
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
