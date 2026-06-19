import type { Bottle, TelegramUser } from "../types";

const API = "https://bottle-api.d7895h.workers.dev";

export async function tgLogin(user: TelegramUser): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/auth/telegram", {
    method: "POST",
    body: JSON.stringify(user)
  });
}

export async function sendBottle(
  userId: number,
  content: string
): Promise<{ ok: boolean; bottle_id: number }> {
  return requestJson<{ ok: boolean; bottle_id: number }>("/bottle/send", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, content })
  });
}

export async function pickBottle(userId: number): Promise<Bottle | null> {
  return requestJson<Bottle | null>(`/bottle/pick?user_id=${userId}`);
}

export async function replyBottle(
  bottleId: number,
  userId: number,
  content: string
): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/bottle/reply", {
    method: "POST",
    body: JSON.stringify({
      bottle_id: bottleId,
      user_id: userId,
      content
    })
  });
}

export async function getMyBottles(userId: number): Promise<Bottle[]> {
  return requestJson<Bottle[]>(`/bottle/mine?user_id=${userId}`);
}

async function requestJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson
    ? ((await res.json()) as T & { error?: string })
    : null;
  const text = isJson ? "" : await res.text();

  if (!res.ok) {
    throw new Error(
      (data && "error" in data && data.error) ||
        text ||
        `请求失败（${res.status}）`
    );
  }

  return (data ?? (text as T)) as T;
}
