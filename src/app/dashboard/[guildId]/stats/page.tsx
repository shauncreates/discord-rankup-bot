import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions, userHasGuildAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SectionHeader from "@/components/SectionHeader";

export default async function StatsPage({ params }: { params: { guildId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const accessToken = (session as any).accessToken as string;
  const hasAccess = await userHasGuildAccess(accessToken, params.guildId);
  if (!hasAccess) notFound();

  const [total, pending, promoted, denied, recent] = await Promise.all([
    prisma.application.count({ where: { guildId: params.guildId } }),
    prisma.application.count({ where: { guildId: params.guildId, status: "PENDING" } }),
    prisma.application.count({ where: { guildId: params.guildId, status: "PROMOTED" } }),
    prisma.application.count({ where: { guildId: params.guildId, status: "DENIED" } }),
    prisma.application.findMany({
      where: { guildId: params.guildId, status: { not: "PENDING" } },
      orderBy: { reviewedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <a href={`/dashboard/${params.guildId}`} className="text-sm text-white/40 hover:text-white/70">
        ← Back to config
      </a>
      <h1 className="text-2xl font-semibold mt-2 mb-8">Stats</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <div className="card bg-panel p-4 text-center">
          <p className="text-2xl font-semibold">{total}</p>
          <p className="text-white/40 text-xs mt-1">Total</p>
        </div>
        <div className="card bg-panel p-4 text-center">
          <p className="text-2xl font-semibold text-yellow-400">{pending}</p>
          <p className="text-white/40 text-xs mt-1">Pending</p>
        </div>
        <div className="card bg-panel p-4 text-center">
          <p className="text-2xl font-semibold text-brand-light">{promoted}</p>
          <p className="text-white/40 text-xs mt-1">Promoted</p>
        </div>
        <div className="card bg-panel p-4 text-center">
          <p className="text-2xl font-semibold text-red-400">{denied}</p>
          <p className="text-white/40 text-xs mt-1">Denied</p>
        </div>
      </div>

      <SectionHeader icon="🗂️" title="Recent decisions" subtitle="Last 20 reviewed applications." />
      <div className="flex flex-col gap-2 mt-4">
        {recent.length === 0 && <p className="text-white/40 text-sm">No decisions yet.</p>}
        {recent.map((a) => (
          <div key={a.id} className="card bg-panel p-3 flex items-center justify-between text-sm">
            <div>
              <span className="text-white/70">User {a.applicantId}</span>
              {a.status === "PROMOTED" ? (
                <span className="text-brand-light"> → {a.assignedRankLabel}</span>
              ) : (
                <span className="text-red-400"> → denied</span>
              )}
            </div>
            <span className="text-white/30 text-xs">
              {a.reviewedAt ? new Date(a.reviewedAt).toLocaleDateString() : ""}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
