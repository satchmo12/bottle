type TelegramAuthBody = {
	id?: number;
	username?: string;
	first_name?: string;
};

interface Env {
	DB: D1Database;
}

type SendBottleBody = {
	user_id?: number;
	content?: string;
};

type ReplyBottleBody = {
	bottle_id?: number;
	user_id?: number;
	content?: string;
};

type BottleRow = {
	id: number;
	user_id: number;
	content: string;
	created_at: number;
	status: string;
};

type ReplyRow = {
	id: number;
	bottle_id: number;
	user_id: number;
	content: string;
	created_at: number;
	reply_user_name: string | null;
};

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const ensuredSchemas = new WeakSet<D1Database>();

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		if (path.startsWith("/bottle") || path.startsWith("/auth") || path.startsWith("/user")) {
			await ensureBottleSchema(env.DB);
		}

		if (path === "/test-db") {
			const result = await env.DB.prepare("SELECT 1 as ok").first();
			return json(result ?? { ok: false });
		}

		if (path === "/auth/telegram" && request.method === "POST") {
			const body = (await request.json()) as TelegramAuthBody;
			const telegramId = body.id;
			const firstName = body.first_name?.trim();

			if (!telegramId || !firstName) {
				return json({ ok: false, error: "缺少 Telegram 用户信息" }, 400);
			}

			await env.DB.prepare(
				`INSERT INTO users (tg_id, username, first_name, created_at)
				 VALUES (?, ?, ?, ?)
				 ON CONFLICT(tg_id) DO UPDATE SET
				   username = excluded.username,
				   first_name = excluded.first_name`
			)
				.bind(String(telegramId), body.username ?? null, firstName, Date.now())
				.run();

			return json({ ok: true });
		}

		if (path === "/user/me" && request.method === "GET") {
			const telegramId = url.searchParams.get("tg_id");

			if (!telegramId) {
				return json({ ok: false, error: "缺少 tg_id" }, 400);
			}

			const user = await env.DB.prepare(`SELECT * FROM users WHERE tg_id = ?`)
				.bind(telegramId)
				.first();

			return json(user ?? null);
		}

		if (path === "/user/check-ban" && request.method === "GET") {
			const telegramId = url.searchParams.get("tg_id");

			if (!telegramId) {
				return json({ ok: false, error: "缺少 tg_id" }, 400);
			}

			const user = await env.DB.prepare(`SELECT banned FROM users WHERE tg_id = ?`)
				.bind(telegramId)
				.first<{ banned?: number }>();

			return json({
				banned: user?.banned === 1,
			});
		}

		if (path === "/bottle/send" && request.method === "POST") {
			const body = (await request.json()) as SendBottleBody;
			const userId = body.user_id;
			const content = body.content?.trim();

			if (!userId || !content) {
				return json({ ok: false, error: "瓶子内容不能为空" }, 400);
			}

			const result = await env.DB.prepare(
				`INSERT INTO bottles (user_id, content, created_at, status)
				 VALUES (?, ?, ?, 'active')`
			)
				.bind(userId, content, Date.now())
				.run();

			return json({
				ok: true,
				bottle_id: Number(result.meta.last_row_id),
			});
		}

		if (path === "/bottle/pick" && request.method === "GET") {
			const userId = readUserId(url.searchParams.get("user_id"));

			if (!userId) {
				return json({ ok: false, error: "缺少 user_id" }, 400);
			}

			const result = await env.DB.prepare(
				`SELECT b.id, b.user_id, b.content, b.created_at, b.status
				 FROM bottles b
				 WHERE b.status = 'active'
				   AND b.user_id != ?
				   AND NOT EXISTS (
				     SELECT 1 FROM bottle_hits h
				     WHERE h.user_id = ? AND h.bottle_id = b.id
				   )
				   AND NOT EXISTS (
				     SELECT 1 FROM bottle_replies r
				     WHERE r.bottle_id = b.id
				   )
				 ORDER BY RANDOM()
				 LIMIT 1`
			)
				.bind(userId, userId)
				.first<BottleRow>();

			if (!result) {
				return json(null);
			}

			await env.DB.prepare(
				`INSERT INTO bottle_hits (user_id, bottle_id, created_at)
				 VALUES (?, ?, ?)`
			)
				.bind(userId, result.id, Date.now())
				.run();

			return json({
				...result,
				replies: [],
			});
		}

		if (path === "/bottle/reply" && request.method === "POST") {
			const body = (await request.json()) as ReplyBottleBody;
			const userId = body.user_id;
			const bottleId = body.bottle_id;
			const content = body.content?.trim();

			if (!userId || !bottleId || !content) {
				return json({ ok: false, error: "回复内容不能为空" }, 400);
			}

			const pickedBottle = await env.DB.prepare(
				`SELECT b.id, b.user_id, b.status
				 FROM bottles b
				 INNER JOIN bottle_hits h
				   ON h.bottle_id = b.id
				 WHERE h.user_id = ?
				   AND b.id = ?
				 LIMIT 1`
			)
				.bind(userId, bottleId)
				.first<{ id: number; user_id: number; status: string }>();

			if (!pickedBottle) {
				return json({ ok: false, error: "请先捞到这个瓶子再回复" }, 403);
			}

			if (pickedBottle.user_id === userId) {
				return json({ ok: false, error: "不能回复自己的瓶子" }, 400);
			}

			const existingReply = await env.DB.prepare(
				`SELECT id FROM bottle_replies WHERE bottle_id = ? LIMIT 1`
			)
				.bind(bottleId)
				.first();

			if (pickedBottle.status !== "active" || existingReply) {
				return json({ ok: false, error: "这个瓶子已经被回复了" }, 400);
			}

			await env.DB.batch([
				env.DB.prepare(
					`INSERT INTO bottle_replies (bottle_id, user_id, content, created_at)
					 VALUES (?, ?, ?, ?)`
				).bind(bottleId, userId, content, Date.now()),
				env.DB.prepare(`UPDATE bottles SET status = 'replied' WHERE id = ?`).bind(
					bottleId
				),
			]);

			return json({ ok: true });
		}

		if (path === "/bottle/mine" && request.method === "GET") {
			const userId = readUserId(url.searchParams.get("user_id"));

			if (!userId) {
				return json({ ok: false, error: "缺少 user_id" }, 400);
			}

			const bottlesResult = await env.DB.prepare(
				`SELECT id, user_id, content, created_at, status
				 FROM bottles
				 WHERE user_id = ?
				 ORDER BY created_at DESC`
			)
				.bind(userId)
				.all<BottleRow>();

			const bottles = bottlesResult.results ?? [];

			if (bottles.length === 0) {
				return json([]);
			}

			const placeholders = bottles.map(() => "?").join(", ");
			const repliesResult = await env.DB.prepare(
				`SELECT
				   r.id,
				   r.bottle_id,
				   r.user_id,
				   r.content,
				   r.created_at,
				   u.first_name AS reply_user_name
				 FROM bottle_replies r
				 LEFT JOIN users u
				   ON CAST(u.tg_id AS INTEGER) = r.user_id
				 WHERE r.bottle_id IN (${placeholders})
				 ORDER BY r.created_at DESC`
			)
				.bind(...bottles.map((bottle: BottleRow) => bottle.id))
				.all<ReplyRow>();

			const repliesByBottleId = new Map<number, ReplyRow[]>();
			for (const reply of repliesResult.results ?? []) {
				const currentReplies = repliesByBottleId.get(reply.bottle_id) ?? [];
				currentReplies.push(reply);
				repliesByBottleId.set(reply.bottle_id, currentReplies);
			}

			return json(
				bottles.map((bottle: BottleRow) => ({
					...bottle,
					replies: repliesByBottleId.get(bottle.id) ?? [],
				}))
			);
		}

		return json({ ok: false, error: "Not Found" }, 404);
	},
} satisfies ExportedHandler<Env>;

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: corsHeaders,
	});
}

function readUserId(value: string | null): number | null {
	if (!value) return null;

	const userId = Number(value);
	return Number.isFinite(userId) ? userId : null;
}

async function ensureBottleSchema(db: D1Database): Promise<void> {
	if (ensuredSchemas.has(db)) return;

	await db.exec(`
		CREATE TABLE IF NOT EXISTS users (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  tg_id TEXT UNIQUE,
		  username TEXT,
		  first_name TEXT,
		  avatar TEXT,
		  banned INTEGER DEFAULT 0,
		  created_at INTEGER
		);

		CREATE TABLE IF NOT EXISTS bottles (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  user_id INTEGER,
		  content TEXT,
		  created_at INTEGER,
		  status TEXT DEFAULT 'active'
		);

		CREATE TABLE IF NOT EXISTS bottle_hits (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  user_id INTEGER,
		  bottle_id INTEGER,
		  created_at INTEGER
		);

		CREATE TABLE IF NOT EXISTS bottle_replies (
		  id INTEGER PRIMARY KEY AUTOINCREMENT,
		  bottle_id INTEGER NOT NULL,
		  user_id INTEGER NOT NULL,
		  content TEXT NOT NULL,
		  created_at INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_bottle_hits_user_bottle
		  ON bottle_hits (user_id, bottle_id);

		CREATE INDEX IF NOT EXISTS idx_bottle_replies_bottle_id
		  ON bottle_replies (bottle_id);
	`);

	ensuredSchemas.add(db);
}
