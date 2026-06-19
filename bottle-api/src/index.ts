type TelegramAuthBody = {
	id?: number;
	username?: string;
	first_name?: string;
};

interface Env {
	DB: D1Database;
	TELEGRAM_BOT_TOKEN?: string;
	WEB_APP_URL?: string;
}

type SendBottleBody = {
	user_id?: number;
	content?: string;
};

type BottleMessageBody = {
	thread_id?: number;
	user_id?: number;
	content?: string;
};

type DeleteBottleBody = {
	bottle_id?: number;
	user_id?: number;
};

type DeleteThreadBody = {
	thread_id?: number;
	user_id?: number;
};

type ConversationSummaryRow = {
	thread_id: number | null;
	bottle_id: number;
	user_id: number;
	content: string;
	created_at: number;
	status: string;
	owner_name: string | null;
	picker_name: string | null;
	picked_at: number | null;
	picked_count: number;
	unread_count: number;
	message_count: number;
	latest_message_id: number | null;
	latest_message_content: string | null;
	latest_message_created_at: number | null;
	latest_message_user_id: number | null;
	latest_sender_name: string | null;
};

type MessageRow = {
	id: number;
	thread_id: number;
	bottle_id: number;
	user_id: number;
	content: string;
	created_at: number;
	sender_name: string | null;
};

type BottleOwnerRow = {
	bottle_id: number;
	user_id: number;
	status: string;
};

type ThreadAccessRow = {
	thread_id: number;
	bottle_id: number;
	owner_user_id: number;
	picker_user_id: number;
	status: string;
	thread_status: string | null;
	has_messages: number;
};

type HiddenStateRow = {
	hit_id: number;
};

type BannedRow = {
	banned?: number;
};

type UserFirstNameRow = {
	first_name?: string | null;
};

type BottleSummaryPayload = {
	id: string;
	thread_id: number | null;
	bottle_id: number;
	user_id: number;
	content: string;
	created_at: number;
	status: string;
	owner_name: string | null;
	picker_name: string | null;
	picked_at: number | null;
	picked_count: number;
	unread_count: number;
	message_count: number;
	can_open_thread: boolean;
	latest_message: MessageRow | null;
};

type BottleThreadPayload = BottleSummaryPayload & {
	thread_id: number;
	can_open_thread: true;
	messages: MessageRow[];
	has_more: boolean;
	next_before_id: number | null;
};

type ThreadMessagesResult = {
	messages: MessageRow[];
	has_more: boolean;
	next_before_id: number | null;
};

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const ensuredSchemas = new WeakSet<D1Database>();
const DEFAULT_THREAD_PAGE_SIZE = 20;
const MAX_THREAD_PAGE_SIZE = 50;

const THREAD_SUMMARY_COLUMNS = `
	h.id AS thread_id,
	b.id AS bottle_id,
	b.user_id,
	b.content,
	b.created_at,
	b.status,
	owner.first_name AS owner_name,
	picker.first_name AS picker_name,
	h.created_at AS picked_at,
	COALESCE((
		SELECT COUNT(*)
		FROM bottle_hits h2
		WHERE h2.bottle_id = b.id
	), 0) AS picked_count,
	COALESCE((
		SELECT COUNT(*)
		FROM bottle_thread_messages m1
		WHERE m1.hit_id = h.id
			AND m1.user_id != ?
			AND m1.id > COALESCE((
				SELECT rs.last_read_message_id
				FROM bottle_thread_read_states rs
				WHERE rs.user_id = ?
					AND rs.hit_id = h.id
				LIMIT 1
			), 0)
	), 0) AS unread_count,
	COALESCE((
		SELECT COUNT(*)
		FROM bottle_thread_messages m2
		WHERE m2.hit_id = h.id
	), 0) AS message_count,
	(
		SELECT m3.id
		FROM bottle_thread_messages m3
		WHERE m3.hit_id = h.id
		ORDER BY m3.id DESC
		LIMIT 1
	) AS latest_message_id,
	(
		SELECT m4.content
		FROM bottle_thread_messages m4
		WHERE m4.hit_id = h.id
		ORDER BY m4.id DESC
		LIMIT 1
	) AS latest_message_content,
	(
		SELECT m5.created_at
		FROM bottle_thread_messages m5
		WHERE m5.hit_id = h.id
		ORDER BY m5.id DESC
		LIMIT 1
	) AS latest_message_created_at,
	(
		SELECT m6.user_id
		FROM bottle_thread_messages m6
		WHERE m6.hit_id = h.id
		ORDER BY m6.id DESC
		LIMIT 1
	) AS latest_message_user_id,
	(
		SELECT u2.first_name
		FROM bottle_thread_messages m7
		LEFT JOIN users u2
			ON CAST(u2.tg_id AS INTEGER) = m7.user_id
		WHERE m7.hit_id = h.id
		ORDER BY m7.id DESC
		LIMIT 1
	) AS latest_sender_name
`;

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		if (
			path.startsWith("/bottle") ||
			path.startsWith("/auth") ||
			path.startsWith("/user")
		) {
			await ensureBottleSchema(env.DB);
		}

		if (path === "/test-db") {
			const result = await env.DB.prepare("SELECT 1 AS ok").first();
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
				.first<BannedRow>();

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
			const userId = readNumber(url.searchParams.get("user_id"));

			if (!userId) {
				return json({ ok: false, error: "缺少 user_id" }, 400);
			}

			const bottle = await env.DB.prepare(
				`SELECT b.id
				 FROM bottles b
				 WHERE b.status != 'deleted'
				   AND b.user_id != ?
				   AND NOT EXISTS (
				     SELECT 1
				     FROM bottle_hits h
				     WHERE h.bottle_id = b.id
				       AND h.user_id = ?
				   )
				 ORDER BY RANDOM()
				 LIMIT 1`
			)
				.bind(userId, userId)
				.first<{ id: number }>();

			if (!bottle) {
				return json(null);
			}

			const pickedAt = Date.now();
			await env.DB.prepare(
				`INSERT OR IGNORE INTO bottle_hits (user_id, bottle_id, created_at)
				 VALUES (?, ?, ?)`
			)
				.bind(userId, bottle.id, pickedAt)
				.run();

			const hit = await env.DB.prepare(
				`SELECT id
				 FROM bottle_hits
				 WHERE user_id = ?
				   AND bottle_id = ?
				 LIMIT 1`
			)
				.bind(userId, bottle.id)
				.first<{ id: number }>();

			if (!hit?.id) {
				return json({ ok: false, error: "创建私聊线程失败" }, 500);
			}

			await env.DB.batch([
				env.DB.prepare(
					`UPDATE bottles
					 SET status = CASE
					   WHEN status = 'active' THEN 'picked'
					   ELSE status
					 END
					 WHERE id = ?`
				).bind(bottle.id),
				env.DB.prepare(
					`INSERT INTO bottle_thread_read_states (user_id, hit_id, last_read_message_id, updated_at)
					 VALUES (?, ?, 0, ?)
					 ON CONFLICT(user_id, hit_id) DO UPDATE SET
					   updated_at = excluded.updated_at`
				).bind(userId, hit.id, pickedAt),
			]);

			const summary = await getThreadSummary(env.DB, hit.id, userId);
			return json(summary);
		}

		if (path === "/bottle/delete" && request.method === "POST") {
			const body = (await request.json()) as DeleteBottleBody;
			const userId = body.user_id;
			const bottleId = body.bottle_id;

			if (!userId || !bottleId) {
				return json({ ok: false, error: "缺少 bottle_id 或 user_id" }, 400);
			}

			const bottle = await getBottleOwner(env.DB, bottleId);

			if (!bottle) {
				return json({ ok: false, error: "瓶子不存在" }, 404);
			}

			if (bottle.user_id !== userId) {
				return json({ ok: false, error: "只有扔瓶子的人可以删除" }, 403);
			}

			await env.DB.prepare(`UPDATE bottles SET status = 'deleted' WHERE id = ?`)
				.bind(bottleId)
				.run();

			await hideBottleThreadsForUser(env.DB, bottleId, userId);

			return json({ ok: true });
		}

		if (path === "/bottle/thread/delete" && request.method === "POST") {
			const body = (await request.json()) as DeleteThreadBody;
			const userId = body.user_id;
			const threadId = body.thread_id;

			if (!userId || !threadId) {
				return json({ ok: false, error: "缺少 thread_id 或 user_id" }, 400);
			}

			const access = await getThreadAccess(env.DB, threadId);

			if (!access) {
				return json({ ok: false, error: "会话不存在" }, 404);
			}

			if (access.owner_user_id !== userId && access.picker_user_id !== userId) {
				return json({ ok: false, error: "你不能删除这条会话" }, 403);
			}

			await env.DB.prepare(
				`INSERT INTO bottle_thread_hidden_states (user_id, hit_id, hidden_at)
				 VALUES (?, ?, ?)
				 ON CONFLICT(user_id, hit_id) DO UPDATE SET
				   hidden_at = excluded.hidden_at`
			)
				.bind(userId, threadId, Date.now())
				.run();

			return json({ ok: true });
		}

		if (
			(path === "/bottle/reply" || path === "/bottle/message") &&
			request.method === "POST"
		) {
			const body = (await request.json()) as BottleMessageBody;
			const userId = body.user_id;
			const threadId = body.thread_id;
			const content = body.content?.trim();

			if (!userId || !threadId || !content) {
				return json({ ok: false, error: "缺少 thread_id 或消息内容" }, 400);
			}

			const access = await getThreadAccess(env.DB, threadId);

			if (!access) {
				return json({ ok: false, error: "会话不存在" }, 404);
			}

			if (access.thread_status === "deleted") {
				return json({ ok: false, error: "这条会话已经不可用" }, 410);
			}

			if (await isThreadHiddenForUser(env.DB, threadId, userId)) {
				return json({ ok: false, error: "这条会话已经被你隐藏" }, 410);
			}

			const isOwner = access.owner_user_id === userId;
			const isPicker = access.picker_user_id === userId;

			if (!isOwner && !isPicker) {
				return json({ ok: false, error: "你不在这个私聊里" }, 403);
			}

			if (isOwner && access.has_messages === 0) {
				return json({ ok: false, error: "对方还没开始聊天" }, 400);
			}

			const createdAt = Date.now();
			const result = await env.DB.prepare(
				`INSERT INTO bottle_thread_messages (hit_id, bottle_id, user_id, content, created_at)
				 VALUES (?, ?, ?, ?, ?)`
			)
				.bind(threadId, access.bottle_id, userId, content, createdAt)
				.run();

			const messageId = Number(result.meta.last_row_id);

			await env.DB.batch([
				env.DB.prepare(
					`UPDATE bottles
					 SET status = CASE
					   WHEN status = 'deleted' THEN 'deleted'
					   ELSE 'chatting'
					 END
					 WHERE id = ?`
				).bind(access.bottle_id),
				env.DB.prepare(
					`INSERT INTO bottle_thread_read_states (user_id, hit_id, last_read_message_id, updated_at)
					 VALUES (?, ?, ?, ?)
					 ON CONFLICT(user_id, hit_id) DO UPDATE SET
					   last_read_message_id = excluded.last_read_message_id,
					   updated_at = excluded.updated_at`
				).bind(userId, threadId, messageId, createdAt),
			]);

			ctx.waitUntil(
				notifyThreadParticipant(env, access, userId, content).catch((error) => {
					console.error("Failed to send Telegram notification", error);
				})
			);

			return json({ ok: true, message_id: messageId });
		}

		if (path === "/bottle/mine" && request.method === "GET") {
			const userId = readNumber(url.searchParams.get("user_id"));

			if (!userId) {
				return json({ ok: false, error: "缺少 user_id" }, 400);
			}

			return json(await getMyBottleSummaries(env.DB, userId));
		}

		if (path === "/bottle/picked" && request.method === "GET") {
			const userId = readNumber(url.searchParams.get("user_id"));

			if (!userId) {
				return json({ ok: false, error: "缺少 user_id" }, 400);
			}

			return json(await getPickedBottleSummaries(env.DB, userId));
		}

		if (path === "/bottle/thread" && request.method === "GET") {
			const userId = readNumber(url.searchParams.get("user_id"));
			const threadId = readNumber(url.searchParams.get("thread_id"));
			const beforeId = readNumber(url.searchParams.get("before_id"));
			const limit = readLimit(url.searchParams.get("limit"));

			if (!userId || !threadId) {
				return json({ ok: false, error: "缺少 user_id 或 thread_id" }, 400);
			}

			const access = await getThreadAccess(env.DB, threadId);

			if (!access) {
				return json({ ok: false, error: "会话不存在" }, 404);
			}

			if (access.thread_status === "deleted") {
				return json({ ok: false, error: "这条会话已经不可用" }, 410);
			}

			if (await isThreadHiddenForUser(env.DB, threadId, userId)) {
				return json({ ok: false, error: "这条会话已经被你隐藏" }, 410);
			}

			if (access.owner_user_id !== userId && access.picker_user_id !== userId) {
				return json({ ok: false, error: "你不在这个私聊里" }, 403);
			}

			const summary = await getThreadSummary(env.DB, threadId, userId);

			if (!summary || summary.thread_id === null) {
				return json({ ok: false, error: "会话不存在" }, 404);
			}

			const threadMessages = await getThreadMessages(
				env.DB,
				threadId,
				limit,
				beforeId
			);

			const payload: BottleThreadPayload = {
				...summary,
				thread_id: summary.thread_id,
				can_open_thread: true,
				messages: threadMessages.messages,
				has_more: threadMessages.has_more,
				next_before_id: threadMessages.next_before_id,
			};

			if (!beforeId) {
				const lastMessageId = payload.messages.at(-1)?.id ?? 0;
				if (lastMessageId > 0) {
					await markThreadAsRead(env.DB, userId, threadId, lastMessageId);
					payload.unread_count = 0;
				}
			}

			return json(payload);
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

function readNumber(value: string | null): number | null {
	if (!value) {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function readLimit(value: string | null): number {
	if (!value) {
		return DEFAULT_THREAD_PAGE_SIZE;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_THREAD_PAGE_SIZE;
	}

	return Math.min(Math.max(Math.trunc(parsed), 1), MAX_THREAD_PAGE_SIZE);
}

function toBottleSummaryPayload(row: ConversationSummaryRow): BottleSummaryPayload {
	return {
		id:
			row.thread_id === null
				? `bottle-${row.bottle_id}`
				: `thread-${row.thread_id}`,
		thread_id: row.thread_id,
		bottle_id: row.bottle_id,
		user_id: row.user_id,
		content: row.content,
		created_at: row.created_at,
		status: row.status,
		owner_name: row.owner_name,
		picker_name: row.picker_name,
		picked_at: row.picked_at,
		picked_count: row.picked_count,
		unread_count: row.unread_count,
		message_count: row.message_count,
		can_open_thread: row.thread_id !== null,
		latest_message:
			row.thread_id === null || row.latest_message_id === null
				? null
				: {
						id: row.latest_message_id,
						thread_id: row.thread_id,
						bottle_id: row.bottle_id,
						user_id: row.latest_message_user_id ?? 0,
						content: row.latest_message_content ?? "",
						created_at: row.latest_message_created_at ?? row.created_at,
						sender_name: row.latest_sender_name,
					},
	};
}

function getSummarySortTime(summary: BottleSummaryPayload): number {
	return (
		summary.latest_message?.created_at ??
		summary.picked_at ??
		summary.created_at
	);
}

async function getMyBottleSummaries(
	db: D1Database,
	userId: number
): Promise<BottleSummaryPayload[]> {
	const [threadRows, dormantRows] = await Promise.all([
		db
			.prepare(
				`SELECT
				   ${THREAD_SUMMARY_COLUMNS}
				 FROM bottle_hits h
				 INNER JOIN bottles b
				   ON b.id = h.bottle_id
				 LEFT JOIN users owner
				   ON CAST(owner.tg_id AS INTEGER) = b.user_id
				 LEFT JOIN users picker
				   ON CAST(picker.tg_id AS INTEGER) = h.user_id
				 WHERE b.user_id = ?
				   AND COALESCE(h.thread_status, 'active') != 'deleted'
				   AND NOT EXISTS (
				     SELECT 1
				     FROM bottle_thread_hidden_states hs
				     WHERE hs.user_id = ?
				       AND hs.hit_id = h.id
				   )`
			)
				.bind(userId, userId, userId, userId)
				.all<ConversationSummaryRow>(),
		db
			.prepare(
				`SELECT
				   NULL AS thread_id,
				   b.id AS bottle_id,
				   b.user_id,
				   b.content,
				   b.created_at,
				   b.status,
				   owner.first_name AS owner_name,
				   NULL AS picker_name,
				   NULL AS picked_at,
				   0 AS picked_count,
				   0 AS unread_count,
				   0 AS message_count,
				   NULL AS latest_message_id,
				   NULL AS latest_message_content,
				   NULL AS latest_message_created_at,
				   NULL AS latest_message_user_id,
				   NULL AS latest_sender_name
				 FROM bottles b
				 LEFT JOIN users owner
				   ON CAST(owner.tg_id AS INTEGER) = b.user_id
				 WHERE b.user_id = ?
				   AND b.status != 'deleted'
				   AND NOT EXISTS (
				     SELECT 1
				     FROM bottle_hits h
				     WHERE h.bottle_id = b.id
				   )`
			)
				.bind(userId)
			.all<ConversationSummaryRow>(),
	]);

	const summaries = [
		...(threadRows.results ?? []).map(toBottleSummaryPayload),
		...(dormantRows.results ?? []).map(toBottleSummaryPayload),
	];

	return summaries.sort((left, right) => {
		const timeDiff = getSummarySortTime(right) - getSummarySortTime(left);
		if (timeDiff !== 0) {
			return timeDiff;
		}

		return right.bottle_id - left.bottle_id;
	});
}

async function getPickedBottleSummaries(
	db: D1Database,
	userId: number
): Promise<BottleSummaryPayload[]> {
	const result = await db
		.prepare(
			`SELECT
			   ${THREAD_SUMMARY_COLUMNS}
			 FROM bottle_hits h
			 INNER JOIN bottles b
			   ON b.id = h.bottle_id
			 LEFT JOIN users owner
			   ON CAST(owner.tg_id AS INTEGER) = b.user_id
			 LEFT JOIN users picker
			   ON CAST(picker.tg_id AS INTEGER) = h.user_id
			 WHERE h.user_id = ?
			   AND COALESCE(h.thread_status, 'active') != 'deleted'
			   AND NOT EXISTS (
			     SELECT 1
			     FROM bottle_thread_hidden_states hs
			     WHERE hs.user_id = ?
			       AND hs.hit_id = h.id
			   )`
		)
			.bind(userId, userId, userId, userId)
			.all<ConversationSummaryRow>();

	return (result.results ?? [])
		.map(toBottleSummaryPayload)
		.sort((left, right) => {
			const timeDiff = getSummarySortTime(right) - getSummarySortTime(left);
			if (timeDiff !== 0) {
				return timeDiff;
			}

			return right.bottle_id - left.bottle_id;
		});
}

async function getThreadSummary(
	db: D1Database,
	threadId: number,
	currentUserId: number
): Promise<BottleSummaryPayload | null> {
	const row = await db
		.prepare(
			`SELECT
			   ${THREAD_SUMMARY_COLUMNS}
			 FROM bottle_hits h
			 INNER JOIN bottles b
			   ON b.id = h.bottle_id
			 LEFT JOIN users owner
			   ON CAST(owner.tg_id AS INTEGER) = b.user_id
			 LEFT JOIN users picker
			   ON CAST(picker.tg_id AS INTEGER) = h.user_id
			 WHERE h.id = ?
			   AND COALESCE(h.thread_status, 'active') != 'deleted'
			 LIMIT 1`
		)
		.bind(currentUserId, currentUserId, threadId)
		.first<ConversationSummaryRow>();

	return row ? toBottleSummaryPayload(row) : null;
}

async function getThreadMessages(
	db: D1Database,
	threadId: number,
	limit: number,
	beforeId: number | null
): Promise<ThreadMessagesResult> {
	const requested = Math.min(Math.max(limit, 1), MAX_THREAD_PAGE_SIZE);
	const fetchLimit = requested + 1;
	const sql = beforeId
		? `SELECT
		     m.id,
		     m.hit_id AS thread_id,
		     m.bottle_id,
		     m.user_id,
		     m.content,
		     m.created_at,
		     u.first_name AS sender_name
		   FROM bottle_thread_messages m
		   LEFT JOIN users u
		     ON CAST(u.tg_id AS INTEGER) = m.user_id
		   WHERE m.hit_id = ?
		     AND m.id < ?
		   ORDER BY m.id DESC
		   LIMIT ?`
		: `SELECT
		     m.id,
		     m.hit_id AS thread_id,
		     m.bottle_id,
		     m.user_id,
		     m.content,
		     m.created_at,
		     u.first_name AS sender_name
		   FROM bottle_thread_messages m
		   LEFT JOIN users u
		     ON CAST(u.tg_id AS INTEGER) = m.user_id
		   WHERE m.hit_id = ?
		   ORDER BY m.id DESC
		   LIMIT ?`;

	const statement = beforeId
		? db.prepare(sql).bind(threadId, beforeId, fetchLimit)
		: db.prepare(sql).bind(threadId, fetchLimit);
	const result = await statement.all<MessageRow>();
	const rows = result.results ?? [];
	const hasMore = rows.length > requested;
	const pageRows = hasMore ? rows.slice(0, requested) : rows;
	const orderedMessages = [...pageRows].reverse();

	return {
		messages: orderedMessages,
		has_more: hasMore,
		next_before_id: hasMore ? orderedMessages[0]?.id ?? null : null,
	};
}

async function markThreadAsRead(
	db: D1Database,
	userId: number,
	threadId: number,
	messageId: number
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO bottle_thread_read_states (user_id, hit_id, last_read_message_id, updated_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(user_id, hit_id) DO UPDATE SET
			   last_read_message_id = excluded.last_read_message_id,
			   updated_at = excluded.updated_at`
		)
		.bind(userId, threadId, messageId, Date.now())
		.run();
}

async function getBottleOwner(
	db: D1Database,
	bottleId: number
): Promise<BottleOwnerRow | null> {
	return db
		.prepare(
			`SELECT
			   id AS bottle_id,
			   user_id,
			   status
			 FROM bottles
			 WHERE id = ?
			 LIMIT 1`
		)
		.bind(bottleId)
		.first<BottleOwnerRow>();
}

async function getThreadAccess(
	db: D1Database,
	threadId: number
): Promise<ThreadAccessRow | null> {
	return db
		.prepare(
			`SELECT
			   h.id AS thread_id,
			   h.bottle_id,
			   b.user_id AS owner_user_id,
			   h.user_id AS picker_user_id,
			   b.status,
			   h.thread_status,
			   EXISTS (
			     SELECT 1
			     FROM bottle_thread_messages m
			     WHERE m.hit_id = h.id
			   ) AS has_messages
			 FROM bottle_hits h
			 INNER JOIN bottles b
			   ON b.id = h.bottle_id
			 WHERE h.id = ?
			 LIMIT 1`
		)
		.bind(threadId)
		.first<ThreadAccessRow>();
}

async function notifyThreadParticipant(
	env: Env,
	access: ThreadAccessRow,
	senderUserId: number,
	content: string
): Promise<void> {
	const botToken = env.TELEGRAM_BOT_TOKEN?.trim();

	if (!botToken) {
		return;
	}

	const recipientUserId =
		senderUserId === access.owner_user_id
			? access.picker_user_id
			: access.owner_user_id;

	if (!recipientUserId || recipientUserId === senderUserId) {
		return;
	}

	if (await isThreadHiddenForUser(env.DB, access.thread_id, recipientUserId)) {
		return;
	}

	const senderName = await getUserFirstName(env.DB, senderUserId);
	const webAppUrl = env.WEB_APP_URL?.trim();
	const normalizedContent = content.trim();
	const messagePreview = normalizedContent
		? normalizedContent.length > 60
			? `${normalizedContent.slice(0, 60)}...`
			: normalizedContent
		: "你收到了新消息，打开小程序查看详情。";
	const text = [
		"漂流瓶有新的私聊消息",
		`来自：${senderName || "对方"}`,
		"",
		`内容预览：${messagePreview}`,
		"打开机器人里的小程序就能继续聊天。",
	].join("\n");

	const replyMarkup = webAppUrl
		? {
				inline_keyboard: [
					[
						{
							text: "打开小程序",
							web_app: {
								url: webAppUrl,
							},
						},
					],
				],
			}
		: undefined;

	const response = await fetch(
		`https://api.telegram.org/bot${botToken}/sendMessage`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				chat_id: recipientUserId,
				text,
				reply_markup: replyMarkup,
			}),
		}
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
	}
}

async function getUserFirstName(
	db: D1Database,
	userId: number
): Promise<string | null> {
	const user = await db
		.prepare(
			`SELECT first_name
			 FROM users
			 WHERE CAST(tg_id AS INTEGER) = ?
			 LIMIT 1`
		)
		.bind(userId)
		.first<UserFirstNameRow>();

	return user?.first_name ?? null;
}

async function isThreadHiddenForUser(
	db: D1Database,
	threadId: number,
	userId: number
): Promise<boolean> {
	const hidden = await db
		.prepare(
			`SELECT hit_id
			 FROM bottle_thread_hidden_states
			 WHERE user_id = ?
			   AND hit_id = ?
			 LIMIT 1`
		)
		.bind(userId, threadId)
		.first<HiddenStateRow>();

	return Boolean(hidden?.hit_id);
}

async function hideBottleThreadsForUser(
	db: D1Database,
	bottleId: number,
	userId: number
): Promise<void> {
	const threads = await db
		.prepare(
			`SELECT id
			 FROM bottle_hits
			 WHERE bottle_id = ?`
		)
		.bind(bottleId)
		.all<{ id: number }>();

	const activeThreads = threads.results ?? [];

	if (activeThreads.length === 0) {
		return;
	}

	await db.batch(
		activeThreads.map((thread) =>
			db
				.prepare(
					`INSERT INTO bottle_thread_hidden_states (user_id, hit_id, hidden_at)
					 VALUES (?, ?, ?)
					 ON CONFLICT(user_id, hit_id) DO UPDATE SET
					   hidden_at = excluded.hidden_at`
				)
				.bind(userId, thread.id, Date.now())
		)
	);
}

async function ensureBottleSchema(db: D1Database): Promise<void> {
	if (ensuredSchemas.has(db)) {
		return;
	}

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tg_id TEXT UNIQUE,
				username TEXT,
				first_name TEXT,
				avatar TEXT,
				banned INTEGER DEFAULT 0,
				created_at INTEGER
			)`
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS bottles (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER,
				content TEXT,
				created_at INTEGER,
				status TEXT DEFAULT 'active'
			)`
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS bottle_hits (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER,
				bottle_id INTEGER,
				created_at INTEGER,
				thread_status TEXT DEFAULT 'active',
				thread_closed_at INTEGER,
				thread_closed_by_user_id INTEGER
			)`
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS bottle_thread_messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				hit_id INTEGER NOT NULL,
				bottle_id INTEGER NOT NULL,
				user_id INTEGER NOT NULL,
				content TEXT NOT NULL,
				created_at INTEGER NOT NULL
			)`
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS bottle_thread_read_states (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				hit_id INTEGER NOT NULL,
				last_read_message_id INTEGER DEFAULT 0,
				updated_at INTEGER NOT NULL,
				UNIQUE(user_id, hit_id)
			)`
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS bottle_thread_hidden_states (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				hit_id INTEGER NOT NULL,
				hidden_at INTEGER NOT NULL,
				UNIQUE(user_id, hit_id)
			)`
		)
		.run();

	await db
		.prepare(
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_bottle_hits_unique
			ON bottle_hits (user_id, bottle_id)`
		)
		.run();

	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_bottle_hits_bottle_id
			ON bottle_hits (bottle_id)`
		)
		.run();

	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_bottle_thread_messages_hit_id
			ON bottle_thread_messages (hit_id, id)`
		)
		.run();

	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_bottle_thread_read_states_user_hit
			ON bottle_thread_read_states (user_id, hit_id)`
		)
		.run();

	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_bottle_thread_hidden_states_user_hit
			ON bottle_thread_hidden_states (user_id, hit_id)`
		)
		.run();

	await ensureBottleHitsColumns(db);

	ensuredSchemas.add(db);
}

async function ensureBottleHitsColumns(db: D1Database): Promise<void> {
	const columns = await db
		.prepare(`PRAGMA table_info('bottle_hits')`)
		.all<{ name?: string }>();
	const columnNames = new Set(
		(columns.results ?? []).map((column) => column.name).filter(Boolean)
	);

	if (!columnNames.has("thread_status")) {
		await db
			.prepare(
				`ALTER TABLE bottle_hits ADD COLUMN thread_status TEXT DEFAULT 'active'`
			)
			.run();
	}

	if (!columnNames.has("thread_closed_at")) {
		await db
			.prepare(`ALTER TABLE bottle_hits ADD COLUMN thread_closed_at INTEGER`)
			.run();
	}

	if (!columnNames.has("thread_closed_by_user_id")) {
		await db
			.prepare(
				`ALTER TABLE bottle_hits ADD COLUMN thread_closed_by_user_id INTEGER`
			)
			.run();
	}
}
