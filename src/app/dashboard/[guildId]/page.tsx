import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions, userHasGuildAccess } from "@/lib/auth";
import { getGuildChannels, getGuildRoles, getGuild } from "@/lib/discord-rest";
import { prisma } from "@/lib/db";
import RankConfigEditor from "@/components/RankConfigEditor";

const CHANNEL_TYPE_GUILD_FORUM = 15;

export default async function GuildConfigPage({ params }: { params: { guildId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const accessToken = (session as any).accessToken as string;
  const hasAccess = await userHasGuildAccess(accessToken, params.guildId);
  if (!hasAccess) notFound();

  const [discordGuild, roles, channels, savedConfig] = await Promise.all([
    getGuild(params.guildId) as Promise<any>,
    getGuildRoles(params.guildId) as Promise<any[]>,
    getGuildChannels(params.guildId) as Promise<any[]>,
    prisma.guild.findUnique({
      where: { id: params.guildId },
      include: { ranks: { orderBy: { position: "asc" } } },
    }),
  ]);

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <a href="/dashboard" className="text-sm text-white/40 hover:text-white/70">
        ← Back to servers
      </a>
      <h1 className="text-2xl font-semibold mt-2 mb-8">{discordGuild.name}</h1>

      <RankConfigEditor
        guildId={params.guildId}
        guildName={discordGuild.name}
        roles={roles.filter((r) => r.name !== "@everyone").map((r) => ({ id: r.id, name: r.name }))}
        forumChannels={channels
          .filter((c) => c.type === CHANNEL_TYPE_GUILD_FORUM)
          .map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          rankerRoleId: savedConfig?.rankerRoleId ?? null,
          forumChannelId: savedConfig?.forumChannelId ?? null,
          ranks: (savedConfig?.ranks ?? []).map((r) => ({
            label: r.label,
            roleId: r.roleId,
            emoji: r.emoji,
          })),
        }}
      />
    </main>
  );
}
