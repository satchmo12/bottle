const path = require("node:path");
const { Markup, Telegraf } = require("telegraf");

if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile(path.join(__dirname, ".env"));
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in telegram-bot/.env`);
  }

  return value;
}

const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
const webAppUrl = getRequiredEnv("WEB_APP_URL");

const bot = new Telegraf(botToken);

bot.start((ctx) => {
  return ctx.reply(
    "🎮 进入游戏大厅",
    Markup.keyboard([
      [Markup.button.webApp("🚀 打开游戏", webAppUrl)]
    ]).resize()
  );
});

bot.catch((error, ctx) => {
  console.error("Telegram bot error", {
    updateType: ctx.updateType,
    error
  });
});

void bot.launch().then(() => {
  console.log("bot started", webAppUrl);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
