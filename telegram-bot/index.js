const path = require("path");
const { Telegraf } = require("telegraf");

if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile(path.join(__dirname, ".env"));
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in telegram-bot/.env`);
  }

  return value;
}

const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
const webAppUrl = getRequiredEnv("WEB_APP_URL");

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
