export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Настройка webhook
    if (url.pathname === "/setup") {
      if (url.searchParams.get("secret") !== env.SETUP_SECRET) {
        return new Response("Доступ запрещён", { status: 403 });
      }

      const webhook =
        `${url.origin}/webhook`;

      const r = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: webhook
          })
        }
      );

      return new Response(await r.text(), {
        headers: {
          "content-type": "application/json"
        }
      });
    }

    // Получение сообщений
    if (url.pathname === "/webhook") {
      const update = await request.json();

      if (update.message) {
        const chatId = update.message.chat.id;
        const text = (update.message.text || "").trim();

        let answer;

        if (text === "/start") {
          answer =
`🥕 Привет!

Напиши продукты через запятую.

Например:

курица, картошка, сыр`;
        } else {
          answer =
`🥘 У тебя есть:

${text}

Пока это тестовая версия.
Следующим шагом я научу бота подбирать рецепты.`;
        }

        await fetch(
          `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: answer
            })
          }
        );
      }

      return new Response("ok");
    }

    return new Response("🥕 FRIDGE BOT работает!");
  }
};
