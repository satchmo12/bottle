const path = require("path");
const { Telegraf } = require("telegraf");


const botToken = "8866041432:AAF7vfyfyv5Pe0T4Nffn6SnGqQp-b9YObAc";
const webAppUrl = "https://bottle.d7895h.workers.dev/";

if (!botToken) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN (or legacy BOT_TOKEN_A) in apps/telegram-bot/.env");
}

const bot = new Telegraf(botToken);
bot.start((ctx) => {
  ctx.reply("🎮 进入游戏大厅", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🚀 打开游戏",
            web_app: {
              url: webAppUrl
            }
          }
        ]
      ]
    }
  });
});

bot.launch();

console.log("bot started", webAppUrl);
