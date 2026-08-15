import DocsShell from "@/components/DocsShell";
import { getBotGuilds } from "@/lib/discord-rest";
import { prisma } from "@/lib/db";

async function checkDiscord() {
  try {
    const guilds = (await getBotGuilds()) as any[];
    return { ok: true, detail: `${guilds.length} servers reachable` };
  } catch (err: any) {
    return { ok: false, detail: err?.message ?? "Unreachable" };
  }
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, detail: "Connected" };
  } catch (err: any) {
    return { ok: false, detail: err?.message ?? "Unreachable" };
  }
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="card bg-panel p-4 flex items-center justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-white/40 text-sm mt-0.5">{detail}</p>
      </div>
      <span
        className={
          "flex items-center gap-1.5 text-sm font-medium " + (ok ? "text-brand-light" : "text-red-400")
        }
      >
        <span
          className={"w-2 h-2 rounded-full " + (ok ? "bg-brand-light" : "bg-red-400")}
          aria-hidden="true"
        />
        {ok ? "Operational" : "Down"}
      </span>
    </div>
  );
}

export default async function StatusPage() {
  const [discord, database] = await Promise.all([checkDiscord(), checkDatabase()]);
  const allOk = discord.ok && database.ok;

  return (
    <DocsShell active="/status">
      <h1 className="text-3xl font-semibold mb-2">Status</h1>
      <p className="text-white/50 mb-8">
        {allOk
          ? "All systems are operational."
          : "Something's degraded — check the components below."}
      </p>

      <div className="flex flex-col gap-3">
        <StatusRow label="Discord API" ok={discord.ok} detail={discord.detail} />
        <StatusRow label="Database" ok={database.ok} detail={database.detail} />
        <StatusRow label="Dashboard" ok={true} detail="You're looking at it" />
      </div>

      <p className="text-white/30 text-xs mt-10">
        TierUp runs on serverless functions rather than a single always-on process, so "status"
        here means "can this request reach Discord and the database right now" — checked live on
        every page load.
      </p>
    </DocsShell>
  );
}
