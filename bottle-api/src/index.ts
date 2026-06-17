/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		const path = url.pathname

		if (url.pathname === "/test-db") {
			const result = await env.DB.prepare(
				"SELECT 1 as ok"
			).first();

			return Response.json(result);
		}

		if (path === "/auth/telegram") {
			const body = await request.json();

			const { id, username, first_name } = body as any;

			await env.DB.prepare(
				`INSERT OR IGNORE INTO users (tg_id, username, first_name, created_at)
     VALUES (?, ?, ?, ?)`
			).bind(id, username, first_name, Date.now()).run();

			return Response.json({ ok: true });
		}


		if (path === "/user/me") {
			const tg_id = url.searchParams.get("tg_id");

			const user = await env.DB.prepare(
				`SELECT * FROM users WHERE tg_id = ?`
			).bind(tg_id).first();

			return Response.json(user);
		}


		if (path === "/user/check-ban") {
			const tg_id = url.searchParams.get("tg_id");

			const user = await env.DB.prepare(
				`SELECT banned FROM users WHERE tg_id = ?`
			).bind(tg_id).first();

			return Response.json({
				banned: user?.banned === 1
			});
		}

		if (path === "/bottle/send") {
			const body = await request.json();

			await env.DB.prepare(
				`INSERT INTO bottles (user_id, content, created_at)
     VALUES (?, ?, ?)`
			).bind(body.user_id, body.content, Date.now()).run();

			return Response.json({ ok: true });
		}

		if (path === "/bottle/pick") {
			const user_id = url.searchParams.get("user_id");

			const bottle = await env.DB.prepare(
				`SELECT * FROM bottles
     WHERE status = 'active'
     ORDER BY RANDOM()
     LIMIT 1`
			).first();

			return Response.json(bottle || {});
		}

		return new Response("OK");
	},


} satisfies ExportedHandler<Env>;
