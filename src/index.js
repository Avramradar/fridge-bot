const TELEGRAM_API = "https://api.telegram.org";

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // Проверка работы Worker
      if (request.method === "GET" && url.pathname === "/") {
        return textResponse("🥕 FRIDGE BOT работает!");
      }

      // Подключение Telegram Webhook
      if (request.method === "GET" && url.pathname === "/setup") {
        const setupKey = url.searchParams.get("key");

        if (!env.SETUP_SECRET || setupKey !== env.SETUP_SECRET) {
          return textResponse("⛔ Доступ запрещён", 403);
        }

        const webhookUrl = `${url.origin}/telegram`;
        const result = await telegramRequest(env.BOT_TOKEN, "setWebhook", {
          url: webhookUrl,
          allowed_updates: ["message"],
          drop_pending_updates: true
        });

        return jsonResponse({
          success: result.ok,
          webhook: webhookUrl,
          telegram: result
        });
      }

      // Информация о текущем Webhook
      if (request.method === "GET" && url.pathname === "/webhook-info") {
        const setupKey = url.searchParams.get("key");

        if (!env.SETUP_SECRET || setupKey !== env.SETUP_SECRET) {
          return textResponse("⛔ Доступ запрещён", 403);
        }

        const result = await telegramRequest(
          env.BOT_TOKEN,
          "getWebhookInfo",
          {}
        );

        return jsonResponse(result);
      }

      // Приём сообщений от Telegram
      if (request.method === "POST" && url.pathname === "/telegram") {
        const update = await request.json();
        await handleTelegramUpdate(update, env.BOT_TOKEN);

        return textResponse("OK");
      }

      return textResponse("Страница не найдена", 404);
    } catch (error) {
      console.error("Worker error:", error);
      return textResponse("Internal error", 500);
    }
  }
};

async function handleTelegramUpdate(update, botToken) {
  const message = update?.message;

  if (!message?.chat?.id) {
    return;
  }

  const chatId = message.chat.id;
  const text = String(message.text || "").trim();

  if (!text) {
    await sendMessage(
      botToken,
      chatId,
      "🥕 Пока я умею анализировать список продуктов, отправленный текстом."
    );
    return;
  }

  const command = text.split(/\s+/)[0].toLowerCase().split("@")[0];

  if (command === "/start") {
    await sendMessage(
      botToken,
      chatId,
      [
        "👋 <b>Добро пожаловать в FRIDGE BOT!</b>",
        "",
        "Я помогу придумать блюда из продуктов, которые уже есть дома.",
        "",
        "Нажмите или отправьте команду:",
        "🥕 /fridge — открыть холодильник",
        "ℹ️ /help — инструкция"
      ].join("\n")
    );
    return;
  }

  if (
    command === "/fridge" ||
    command === "/холодильник"
  ) {
    await sendMessage(
      botToken,
      chatId,
      [
        "🥕 <b>Что есть в холодильнике?</b>",
        "",
        "Напишите продукты через запятую.",
        "",
        "Например:",
        "<code>курица, картофель, сыр, яйца</code>"
      ].join("\n"),
      {
        force_reply: true,
        input_field_placeholder: "Курица, картофель, сыр..."
      }
    );
    return;
  }

  if (command === "/help") {
    await sendMessage(
      botToken,
      chatId,
      [
        "ℹ️ <b>Как пользоваться ботом</b>",
        "",
        "1. Отправьте /fridge",
        "2. Перечислите продукты через запятую",
        "3. Получите идеи блюд, советы и список недостающих продуктов",
        "",
        "Можно сразу написать:",
        "<code>рис, курица, морковь, лук</code>"
      ].join("\n")
    );
    return;
  }

  if (text.startsWith("/")) {
    await sendMessage(
      botToken,
      chatId,
      "Неизвестная команда. Используйте /fridge или /help."
    );
    return;
  }

  const ingredients = parseIngredients(text);

  if (ingredients.length === 0) {
    await sendMessage(
      botToken,
      chatId,
      "Не удалось распознать продукты. Перечислите их через запятую."
    );
    return;
  }

  const answer = buildFridgeAnswer(ingredients);
  await sendMessage(botToken, chatId, answer);
}

function parseIngredients(text) {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[.;\n|/]+/g, ",")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 50)
  )].slice(0, 30);
}

function buildFridgeAnswer(ingredients) {
  const normalized = ingredients.join(" ");
  const dishes = [];
  const tips = [];
  const missing = new Set();

  const has = (...words) =>
    words.some((word) => normalized.includes(word));

  const addDish = (title, description) => {
    if (!dishes.some((dish) => dish.title === title)) {
      dishes.push({ title, description });
    }
  };

  if (
    has("куриц", "индейк") &&
    has("картоф")
  ) {
    addDish(
      "Курица с картофелем",
      "Нарежьте продукты, добавьте масло и специи. Запекайте около 40–50 минут при 190 °C."
    );

    if (!has("лук")) missing.add("лук");
    if (!has("чеснок")) missing.add("чеснок");
  }

  if (
    has("яйц") &&
    has("сыр")
  ) {
    addDish(
      "Сырный омлет",
      "Взбейте яйца, добавьте тёртый сыр и готовьте под крышкой 5–7 минут."
    );

    if (!has("молок", "сливк")) missing.add("молоко");
  }

  if (
    has("макарон", "паст", "спагет") &&
    has("сыр")
  ) {
    addDish(
      "Макароны с сыром",
      "Отварите макароны, добавьте сыр и немного воды от варки. Хорошо перемешайте."
    );

    if (!has("масл")) missing.add("сливочное масло");
  }

  if (
    has("рис") &&
    has("куриц", "мяс", "индейк")
  ) {
    addDish(
      "Рис с мясом на сковороде",
      "Обжарьте мясо, добавьте рис и воду. Готовьте под крышкой до мягкости риса."
    );

    if (!has("морков")) missing.add("морковь");
    if (!has("лук")) missing.add("лук");
  }

  if (
    has("картоф") &&
    has("яйц")
  ) {
    addDish(
      "Картофельная фриттата",
      "Обжарьте тонкие ломтики картофеля, залейте яйцами и доведите под крышкой."
    );
  }

  if (
    has("помидор", "томат") &&
    has("огур")
  ) {
    addDish(
      "Свежий овощной салат",
      "Нарежьте овощи, добавьте соль и растительное масло."
    );

    if (!has("зелень", "укроп", "петруш")) missing.add("зелень");
  }

  if (
    has("творог") &&
    has("яйц")
  ) {
    addDish(
      "Сырники",
      "Смешайте творог с яйцом и небольшим количеством муки, сформируйте и обжарьте."
    );

    if (!has("мук")) missing.add("мука");
    if (!has("сахар")) missing.add("сахар");
  }

  if (
    has("хлеб", "батон") &&
    has("сыр")
  ) {
    addDish(
      "Горячие бутерброды",
      "Выложите сыр и другие продукты на хлеб. Запекайте 7–10 минут."
    );
  }

  if (
    has("капуст") &&
    has("морков")
  ) {
    addDish(
      "Салат из капусты",
      "Тонко нашинкуйте капусту, натрите морковь, добавьте соль и масло."
    );
  }

  if (
    has("овсян", "геркулес") &&
    has("молок")
  ) {
    addDish(
      "Овсяная каша",
      "Варите хлопья в молоке 5–10 минут. Можно добавить фрукты или мёд."
    );
  }

  if (dishes.length === 0) {
    addDish(
      "Сборное блюдо на сковороде",
      "Нарежьте продукты небольшими кусочками. Сначала обжарьте самые плотные, затем добавьте остальные."
    );

    addDish(
      "Запеканка из имеющихся продуктов",
      "Соедините продукты в форме. Для связки подойдут яйца, сыр, сметана или простой соус."
    );

    addDish(
      "Тёплый салат",
      "Обжарьте продукты, которые требуют приготовления, и соедините со свежими ингредиентами."
    );
  }

  if (has("куриц", "мяс", "рыб")) {
    tips.push(
      "Сырое мясо и рыбу держите отдельно от готовых продуктов."
    );
  }

  if (has("сыр")) {
    tips.push(
      "Сыр лучше хранить в пергаменте или контейнере, а не в открытом пакете."
    );
  }

  if (has("зелень", "укроп", "петруш")) {
    tips.push(
      "Зелень дольше сохранится в контейнере с бумажным полотенцем."
    );
  }

  if (has("картоф")) {
    tips.push(
      "Картофель храните в тёмном прохладном месте, отдельно от лука."
    );
  }

  if (tips.length === 0) {
    tips.push(
      "Сначала используйте продукты с ближайшим сроком годности."
    );
  }

  const dishesText = dishes
    .slice(0, 4)
    .map(
      (dish, index) =>
        `<b>${index + 1}. ${escapeHtml(dish.title)}</b>\n${escapeHtml(dish.description)}`
    )
    .join("\n\n");

  const missingText = missing.size
    ? [...missing]
        .slice(0, 6)
        .map((item) => `• ${escapeHtml(item)}`)
        .join("\n")
    : "Ничего обязательного — можно готовить из имеющихся продуктов.";

  const tipsText = tips
    .slice(0, 4)
    .map((tip) => `• ${escapeHtml(tip)}`)
    .join("\n");

  const productsText = ingredients
    .map((item) => escapeHtml(item))
    .join(", ");

  return [
    "🥕 <b>Что можно приготовить</b>",
    "",
    `<b>Ваши продукты:</b> ${productsText}`,
    "",
    dishesText,
    "",
    "🛒 <b>Что можно докупить</b>",
    missingText,
    "",
    "❄️ <b>Советы по хранению</b>",
    tipsText,
    "",
    "Чтобы проверить другой набор, отправьте /fridge"
  ].join("\n");
}

async function sendMessage(
  botToken,
  chatId,
  text,
  forceReply = null
) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  };

  if (forceReply) {
    payload.reply_markup = forceReply;
  }

  return telegramRequest(botToken, "sendMessage", payload);
}

async function telegramRequest(botToken, method, payload) {
  if (!botToken) {
    throw new Error("BOT_TOKEN is missing");
  }

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

  const data = await response.json();

  if (!data.ok) {
    console.error("Telegram API error:", data);
  }

  return data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: {
      "content-type": "text/plain; charset=UTF-8"
    }
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8"
    }
  });
}
