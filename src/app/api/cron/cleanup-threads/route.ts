import { prisma } from "@/lib/db";
import { deleteChannel } from "@/lib/discord-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron calls this on a schedule (see vercel.json). It replaces the
// `asyncio.sleep(4 * 3600)` background task from the old gateway bot: since
// serverless functions can't sleep for hours, we instead store a due-date
// row and sweep for expired ones periodically.
export async function GET(request: Request) {
  // Protect the endpoint so randoms on the internet can't trigger it.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const due = await prisma.pendingThreadDeletion.findMany({
    where: { deleteAt: { lte: new Date() } },
    take: 50,
  });

  const results = await Promise.allSettled(
    due.map(async (row) => {
      try {
        await deleteChannel(row.channelId);
      } catch (err: any) {
        // Thread already gone (manually deleted, etc.) — that's fine, just
        // clear the pending row so we stop retrying it. Any other error
        // (e.g. missing permissions) should surface and be retried.
        if (!String(err?.message).includes("404")) throw err;
      }
      await prisma.pendingThreadDeletion.delete({ where: { id: row.id } });
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;

  return Response.json({ processed: due.length, failed });
}
