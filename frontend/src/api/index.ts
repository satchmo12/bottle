import type { TelegramUser, Bottle } from "../types";

const API = "https://bottle-api.d7895h.workers.dev";

/**
 * Telegram 登录
 */
export async function tgLogin(user: TelegramUser): Promise<{ ok: boolean }> {
  const res = await fetch(`${API}/auth/telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(user)
  });

  return res.json();
}

/**
 * 扔瓶子
 */
export async function sendBottle(
  user_id: number,
  content: string
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API}/bottle/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user_id, content })
  });

  return res.json();
}

/**
 * 捞瓶子
 */
export async function pickBottle(
  user_id: number
): Promise<Bottle | null> {
  const res = await fetch(
    `${API}/bottle/pick?user_id=${user_id}`
  );

  return res.json();
}