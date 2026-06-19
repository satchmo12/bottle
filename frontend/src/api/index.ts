import type { Bottle, BottleThread, TelegramUser } from "../types";

const API =
  import.meta.env.VITE_API_BASE_URL || "https://bottle-api.d7895h.workers.dev";
const REQUEST_TIMEOUT_MS = 10000;

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

export async function sendBottleMessage(
  threadId: number,
  userId: number,
  content: string
): Promise<{ ok: boolean; message_id: number }> {
  return requestJson<{ ok: boolean; message_id: number }>("/bottle/message", {
    method: "POST",
    body: JSON.stringify({
      thread_id: threadId,
      user_id: userId,
      content
    })
  });
}

export async function getMyThrownBottles(userId: number): Promise<Bottle[]> {
  return requestJson<Bottle[]>(`/bottle/mine?user_id=${userId}`);
}

export async function getPickedBottles(userId: number): Promise<Bottle[]> {
  return requestJson<Bottle[]>(`/bottle/picked?user_id=${userId}`);
}

export async function getBottleThread(
  userId: number,
  threadId: number,
  options?: { beforeId?: number | null; limit?: number }
): Promise<BottleThread> {
  const params = new URLSearchParams({
    user_id: String(userId),
    thread_id: String(threadId),
    limit: String(options?.limit ?? 20)
  });

  if (options?.beforeId) {
    params.set("before_id", String(options.beforeId));
  }

  return requestJson<BottleThread>(`/bottle/thread?${params.toString()}`);
}

export async function deleteBottle(
  bottleId: number,
  userId: number
): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/bottle/delete", {
    method: "POST",
    body: JSON.stringify({
      bottle_id: bottleId,
      user_id: userId
    })
  });
}

export async function deleteBottleThread(
  threadId: number,
  userId: number
): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/bottle/thread/delete", {
    method: "POST",
    body: JSON.stringify({
      thread_id: threadId,
      user_id: userId
    })
  });
}

async function requestJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let res: Response;

  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    throw formatRequestError(path, error);
  }

  window.clearTimeout(timeoutId);

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

function formatRequestError(path: string, error: unknown): Error {
  if (error instanceof DOMException && error.name === "AbortError") {
    return new Error(`请求超时：${path}`);
  }

  if (error instanceof Error) {
    if (error.message === "Load failed" || error.message === "Failed to fetch") {
      return new Error(`无法连接接口：${API}${path}`);
    }

    return error;
  }

  return new Error(`请求失败：${API}${path}`);
}
