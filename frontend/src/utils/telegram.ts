import type { TelegramUser } from "../types";

export function getTelegram() {
  return window.Telegram?.WebApp ?? null;
}

export function initTelegram() {
  const tg = getTelegram();
  if (!tg) return null;

  tg.ready();
  tg.expand();

  return tg;
}

export function getTelegramUser(): TelegramUser | null {
  return getTelegram()?.initDataUnsafe?.user ?? null;
}

export function getTelegramInitData(): string {
  return getTelegram()?.initData ?? "";
}
