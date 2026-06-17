
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/bottle/throw" && request.method === "POST") {
      const body = await request.json();
      await env.DB.prepare(
        "INSERT INTO bottles (user_id, content, status) VALUES (?, ?, 'waiting')"
      ).bind(body.userId, body.content).run();
      return Response.json({ success: true });
    }

    if (url.pathname === "/bottle/pick" && request.method === "POST") {
      const body = await request.json();
      const result = await env.DB.prepare(
        "SELECT * FROM bottles WHERE status='waiting' AND user_id != ? ORDER BY RANDOM() LIMIT 1"
      ).bind(body.userId).first();

      if (!result) return Response.json({ message: "no bottle" });

      await env.DB.prepare(
        "UPDATE bottles SET status='picked' WHERE id=?"
      ).bind(result.id).run();

      return Response.json(result);
    }

    return new Response("Not Found", { status: 404 });
  }
}
