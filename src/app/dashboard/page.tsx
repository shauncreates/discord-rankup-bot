import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions, getUserAdminGuilds } from "@/lib/auth";
import { getBotGuilds } from "@/lib/discord-rest";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const accessToken = (session as any).accessToken as string;
  const [userGuilds, botGuilds] = await Promise.all([
    getUserAdminGuilds(accessToken),
    getBotGuilds() as Promise<any[]>,
  ]);

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
      <h1 className="text-2xl font-semibold mb-1">Your servers</h1>
      <p className="text-white/50 mb-8">Pick a server to configure its rank tiers and roles.</p>

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
            className="flex items-center gap-3 bg-panel hover:bg-panel/70 transition rounded-lg px-4 py-3"
          >
            {g.icon ? (
              <img
                src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`}
                className="w-8 h-8 rounded-full"
                alt=""
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blurple/40" />
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
                className="flex items-center justify-between bg-panel/50 rounded-lg px-4 py-3"
              >
                <span>{g.name}</span>
                <span className="text-blurple text-sm">Add bot →</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
