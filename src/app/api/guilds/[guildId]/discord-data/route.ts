import { getServerSession } from "next-auth";
import { authOptions, userHasGuildAccess } from "@/lib/auth";
import { getGuildChannels, getGuildEmojis, getGuildRoles } from "@/lib/discord-rest";

const CHANNEL_TYPE_GUILD_FORUM = 15;

export async function GET(request: Request, { params }: { params: { guildId: string } }) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken;
  if (!session || !accessToken) return new Response("Unauthorized", { status: 401 });

  const hasAccess = await userHasGuildAccess(accessToken, params.guildId);
  if (!hasAccess) return new Response("Forbidden", { status: 403 });

  const [roles, channels, emojis] = await Promise.all([
    getGuildRoles(params.guildId),
    getGuildChannels(params.guildId),
    getGuildEmojis(params.guildId),
  ]);

  return Response.json({
    roles: (roles as any[])
      .filter((r) => r.name !== "@everyone")
      .map((r) => ({ id: r.id, name: r.name, color: r.color })),
    forumChannels: (channels as any[])
      .filter((c) => c.type === CHANNEL_TYPE_GUILD_FORUM)
      .map((c) => ({ id: c.id, name: c.name })),
    emojis: (emojis as any[]).map((e) => ({
      id: e.id,
      name: e.name,
      animated: !!e.animated,
    })),
  });
}
