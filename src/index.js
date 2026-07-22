const TELEGRAM_API = "https://api.telegram.org";
const CHANNEL_USERNAME = "FoodRadarDaily";
const MAX_CHANNEL_PAGES = 5;

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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/setup") {
      return setupWebhook(url, env);
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
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
      "🥕 RadarFridge работает. Источник рецептов: @FoodRadarDaily.",
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
    return new Response("Не настроены BOT_TOKEN или SETUP_SECRET", {
      status: 500
    });
  }

  if (url.searchParams.get("secret") !== env.SETUP_SECRET) {
    return new Response("Доступ запрещён", {
      status: 403
    });
  }

  const webhookUrl = `${url.origin}/webhook`;

  const result = await telegramApi(env.BOT_TOKEN, "setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "channel_post", "edited_channel_post"]
  });

  return Response.json(result);
}

async function handleUpdate(update, env) {
  /*
   * Посты канала бот видит, но не отвечает на них.
   * Рецепты читаются с публичной страницы канала во время поиска.
   */
  if (update?.channel_post || update?.edited_channel_post) {
    return;
  }

  const message = update?.message;

  if (!message?.chat?.id) {
    return;
  }

  /*
   * Бот отвечает только в личном чате.
   */
  if (message.chat.type && message.chat.type !== "private") {
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
        "курица, картошка, сыр, лук",
        "",
        `Я поищу подходящие рецепты в канале @${CHANNEL_USERNAME}.`
      ].join("\n")
    );

    return;
  }

  if (text === "/sources") {
    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "📡 Главный источник рецептов:",
        "",
        `https://t.me/${CHANNEL_USERNAME}`,
        "",
        "Поиск выполняется по последним публикациям канала."
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

  await sendChatAction(env.BOT_TOKEN, chatId, "typing");

  await sendMessage(
    env.BOT_TOKEN,
    chatId,
    [
      `🔎 Ищу рецепты в @${CHANNEL_USERNAME}...`,
      "",
      `🥕 Продукты: ${ingredients.join(", ")}`
    ].join("\n")
  );

  try {
    const recipes = await searchChannelRecipes(ingredients);

    if (recipes.length === 0) {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        [
          "Подходящих публикаций пока не нашлось.",
          "",
          `🥕 Запрос: ${ingredients.join(", ")}`,
          "",
          `Открой канал: https://t.me/${CHANNEL_USERNAME}`
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
        "",
        "Лучшие варианты 👇"
      ].join("\n")
    );

    for (let index = 0; index < recipes.length; index++) {
      await sendChannelRecipe(
        env.BOT_TOKEN,
        chatId,
        recipes[index],
        index + 1
      );

      await sleep(250);
    }
  } catch (error) {
    console.error("Channel search error:", error);

    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      [
        "⚠️ Сейчас не удалось прочитать канал.",
        "",
        "Попробуй повторить поиск через несколько секунд.",
        "",
        `Канал: https://t.me/${CHANNEL_USERNAME}`
      ].join("\n")
    );
  }
}
