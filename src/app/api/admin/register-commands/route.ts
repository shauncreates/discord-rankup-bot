import { DISCORD_COMMANDS } from "@/lib/discord-commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = `https://discord.com/api/v10/applications/${process.env.DISCORD_APPLICATION_ID}/commands`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(DISCORD_COMMANDS),
  });

  const body = await res.json();
  if (!res.ok) {
    return Response.json({ ok: false, status: res.status, body }, { status: 500 });
  }
  return Response.json({ ok: true, registered: body.map((c: any) => c.name) });
}
