import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions, getUserAdminGuilds } from "@/lib/auth";
import { getBotGuilds } from "@/lib/discord-rest";
import SectionHeader from "@/components/SectionHeader";
import LogoutButton from "@/components/LogoutButton";
import Logo from "@/components/Logo";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const accessToken = (session as any).accessToken as string;

  let userGuilds: any[] = [];
  let botGuilds: any[] = [];
  let loadError: string | null = null;
  try {
    [userGuilds, botGuilds] = await Promise.all([
      getUserAdminGuilds(accessToken),
      getBotGuilds() as Promise<any[]>,
    ]);
  } catch (err: any) {
    loadError = err?.message ?? "Failed to load servers from Discord.";
  }

  const botGuildIds = new Set(botGuilds.map((g) => g.id));
  const manageable = userGuilds.filter((g) => botGuildIds.has(g.id));
  const missingBot = userGuilds.filter((g) => !botGuildIds.has(g.id));

  // Permissions: View Channels, Send Messages, Embed Links, Manage Roles,
  // Manage Threads, Create Public Threads, Send Messages in Threads.
  // Recompute with Discord's permission calculator if you add features.
  const BOT_PERMISSIONS = 326685969408;
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=${BOT_PERMISSIONS}`;

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Logo />
        <LogoutButton />
      </div>

      <SectionHeader
        icon="🖥️"
        title="Your servers"
        subtitle="Pick a server to configure its rank tiers and roles."
      />

      {loadError && (
        <div className="card bg-panel p-4 mb-6 border-red-500/30">
          <p className="text-red-400 text-sm font-medium">Couldn't load your servers</p>
          <p className="text-white/50 text-sm mt-1">{loadError}</p>
          <p className="text-white/30 text-xs mt-2">
            This usually means DISCORD_BOT_TOKEN in your deployment's environment variables is
            missing or out of date — check it matches your current bot token.
          </p>
        </div>
      )}

      {manageable.length === 0 && (
        <p className="text-white/50 mb-6">
          No servers found where you're an admin and the bot is already added.
        </p>
      )}

      <div className="flex flex-col gap-2 mb-10">
        {manageable.map((g) => (
          <Link
            key={g.id}
            href={`/dashboard/${g.id}`}
            className="card flex items-center gap-3 bg-panel px-4 py-3"
          >
            {g.icon ? (
              <img
                src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`}
                className="w-8 h-8 rounded-full"
                alt=""
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand/40" />
            )}
            <span className="font-medium">{g.name}</span>
          </Link>
        ))}
      </div>

      {missingBot.length > 0 && (
        <div>
          <h2 className="text-sm uppercase tracking-wide text-white/40 mb-3">
            Admin, but bot not added yet
          </h2>
          <div className="flex flex-col gap-2">
            {missingBot.map((g) => (
              <a
                key={g.id}
                href={`${inviteUrl}&guild_id=${g.id}`}
                target="_blank"
                rel="noreferrer"
                className="card flex items-center justify-between bg-panel/50 px-4 py-3"
              >
                <span>{g.name}</span>
                <span className="text-brand text-sm">Add bot →</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
