import { getServerSession } from "next-auth";
import { authOptions, userHasGuildAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAccess(guildId: string) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken;
  if (!session || !accessToken) return { error: new Response("Unauthorized", { status: 401 }) };

  const hasAccess = await userHasGuildAccess(accessToken, guildId);
  if (!hasAccess) return { error: new Response("Forbidden", { status: 403 }) };

  return { error: null };
}

export async function GET(request: Request, { params }: { params: { guildId: string } }) {
  const { error } = await requireAccess(params.guildId);
  if (error) return error;

  const guild = await prisma.guild.findUnique({
    where: { id: params.guildId },
    include: {
      ranks: { orderBy: { position: "asc" } },
      questions: { orderBy: { position: "asc" } },
    },
  });

  return Response.json(
    guild ?? {
      id: params.guildId,
      rankerRoleId: null,
      forumChannelId: null,
      reapplyCooldownHours: 24,
      ranks: [],
      questions: [],
    }
  );
}

export async function PUT(request: Request, { params }: { params: { guildId: string } }) {
  const { error } = await requireAccess(params.guildId);
  if (error) return error;

  const body = await request.json();
  const { rankerRoleId, forumChannelId, ranks, questions, reapplyCooldownHours, guildName } = body as {
    rankerRoleId: string | null;
    forumChannelId: string | null;
    guildName?: string;
    reapplyCooldownHours?: number;
    ranks: { label: string; roleId: string; emoji: string | null }[];
    questions?: { label: string }[];
  };

  if (!Array.isArray(ranks) || ranks.some((r) => !r.label || !r.roleId)) {
    return new Response("Each rank needs a label and a role.", { status: 400 });
  }

  const cleanQuestions = (questions ?? []).filter((q) => q.label?.trim()).slice(0, 3);
  const cooldown = Number.isFinite(reapplyCooldownHours) ? Math.max(0, Math.floor(reapplyCooldownHours!)) : 24;

  await prisma.$transaction(async (tx) => {
    await tx.guild.upsert({
      where: { id: params.guildId },
      update: { rankerRoleId, forumChannelId, name: guildName, reapplyCooldownHours: cooldown },
      create: {
        id: params.guildId,
        rankerRoleId,
        forumChannelId,
        name: guildName,
        reapplyCooldownHours: cooldown,
      },
    });

    // Simplest correct approach: replace the rank + question lists wholesale on save.
    await tx.rank.deleteMany({ where: { guildId: params.guildId } });
    await tx.rank.createMany({
      data: ranks.map((r, i) => ({
        guildId: params.guildId,
        label: r.label,
        roleId: r.roleId,
        emoji: r.emoji || null,
        position: i,
      })),
    });

    await tx.question.deleteMany({ where: { guildId: params.guildId } });
    if (cleanQuestions.length) {
      await tx.question.createMany({
        data: cleanQuestions.map((q, i) => ({
          guildId: params.guildId,
          label: q.label,
          position: i,
        })),
      });
    }
  });

  return Response.json({ ok: true });
}
