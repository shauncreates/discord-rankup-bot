import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBotGuilds } from "@/lib/discord-rest";
import Logo from "@/components/Logo";
import LoginButton from "@/components/LoginButton";

export default async function Home() {
  const session = await getServerSession(authOptions);

  let serverCount: number | null = null;
  try {
    const guilds = (await getBotGuilds()) as any[];
    serverCount = guilds.length;
  } catch {
    // Bot token not configured yet, or Discord unreachable — landing page
    // still works fine without the live count.
  }

  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=326685969408`;

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <Logo />
        <div className="flex items-center gap-6 text-sm text-white/70">
          <Link href="/help" className="hover:text-white transition">
            Commands
          </Link>
          <Link href="/status" className="hover:text-white transition">
            Status
          </Link>
          <Link href="/help" className="hover:text-white transition">
            Help
          </Link>
          {session ? (
            <Link
              href="/dashboard"
              className="bg-panel card px-4 py-1.5 text-white hover:text-brand-light transition"
            >
              Dashboard
            </Link>
          ) : (
            <span className="card">
              <LoginButton label="Dashboard" compact />
            </span>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 pt-20 pb-32">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight max-w-2xl">
          TierUp is the rank management app for creator servers
        </h1>
        <p className="text-white/50 max-w-lg mt-5 text-lg">
          Let members submit their work, review it, and assign skill tiers — all configured from
          one dashboard, no code required.
        </p>

        <div className="flex items-center gap-3 mt-8">
          <a
            href={inviteUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-brand hover:brightness-110 transition rounded-lg px-5 py-2.5 font-medium"
          >
            Invite to Discord
          </a>
          <Link
            href="/help"
            className="card bg-panel px-5 py-2.5 font-medium text-white/80 hover:text-white transition"
          >
            View commands →
          </Link>
        </div>

        {serverCount !== null && (
          <p className="text-white/40 text-sm mt-10">
            Live in <span className="text-brand-light font-medium">{serverCount}</span>{" "}
            {serverCount === 1 ? "server" : "servers"}
          </p>
        )}

        <div className="grid sm:grid-cols-3 gap-4 mt-24">
          <div className="card bg-panel p-5">
            <span className="text-2xl" aria-hidden="true">
              ⚙️
            </span>
            <p className="font-medium mt-3">No-code setup</p>
            <p className="text-white/50 text-sm mt-1">
              Configure rank tiers and roles entirely from the dashboard.
            </p>
          </div>
          <div className="card bg-panel p-5">
            <span className="text-2xl" aria-hidden="true">
              🖥️
            </span>
            <p className="font-medium mt-3">Multi-server ready</p>
            <p className="text-white/50 text-sm mt-1">
              One bot, unlimited servers, each with its own tiers.
            </p>
          </div>
          <div className="card bg-panel p-5">
            <span className="text-2xl" aria-hidden="true">
              🏆
            </span>
            <p className="font-medium mt-3">Custom rank tiers</p>
            <p className="text-white/50 text-sm mt-1">
              Name, order, and assign a role to every tier you want.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 mt-16 text-sm">
          <div className="flex-1 border-l-2 border-brand pl-4">
            <p className="text-white/30">Step 1</p>
            <p className="mt-1">
              Run <code className="text-brand-light">/setup</code> in a channel
            </p>
          </div>
          <div className="flex-1 border-l-2 border-brand pl-4">
            <p className="text-white/30">Step 2</p>
            <p className="mt-1">Members apply with a link</p>
          </div>
          <div className="flex-1 border-l-2 border-brand pl-4">
            <p className="text-white/30">Step 3</p>
            <p className="mt-1">Rankers tap a tier to promote</p>
          </div>
        </div>
      </main>
    </div>
  );
}
