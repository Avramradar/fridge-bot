export default {
  async fetch(request) {
    return new Response(
      "🥕 FRIDGE BOT работает!",
      {
        headers: {
          "content-type": "text/plain; charset=UTF-8"
        }
      }
    );
  }
};
