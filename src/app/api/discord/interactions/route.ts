import { verifyKey } from "discord-interactions";
import { prisma } from "@/lib/db";
import {
  addRoleToMember,
  removeRoleFromMember,
  getGuildMember,
  createThreadInForum,
  sendMessage,
  sendDM,
} from "@/lib/discord-rest";
import {
  buildApplicationEmbed,
  buildRankButtonRows,
  buildSetupComponents,
  buildSetupEmbed,
  WATERMARK,
} from "@/lib/discord-embeds";

export const runtime = "nodejs"; // needed for Prisma

const InteractionType = { PING: 1, APPLICATION_COMMAND: 2, MESSAGE_COMPONENT: 3, MODAL_SUBMIT: 5 };
const ResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
};
const MessageFlags = { EPHEMERAL: 1 << 6 };

// Used whenever a server hasn't configured any custom application questions
// yet — keeps the original "Edit Link" / "App Used" behavior as the default.
const DEFAULT_QUESTIONS = [
  { id: "edit_link", label: "Edit Link", placeholder: "https://tiktok.com/..." },
  { id: "app_used", label: "App Used", placeholder: "e.g., CapCut, Alight Motion, etc." },
];

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const rawBody = await request.text();

  if (!signature || !timestamp) {
    return new Response("Missing signature headers", { status: 401 });
  }

  const isValid = await verifyKey(
    rawBody,
    signature,
    timestamp,
    process.env.DISCORD_PUBLIC_KEY!
  );
  if (!isValid) {
    return new Response("Invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody);

  if (interaction.type === InteractionType.PING) {
    return json({ type: ResponseType.PONG });
  }

  try {
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      return await handleCommand(interaction);
    }
    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      return await handleComponent(interaction);
    }
    if (interaction.type === InteractionType.MODAL_SUBMIT) {
      return await handleModalSubmit(interaction);
    }
  } catch (err) {
    console.error("Interaction handling error:", err);
    return json({
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "❌ Something went wrong handling that. Try again.", flags: MessageFlags.EPHEMERAL },
    });
  }

  return new Response("Unhandled interaction type", { status: 400 });
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function displayTag(interaction: any) {
  const user = interaction.member?.user ?? interaction.user;
  return user?.global_name ?? user?.username ?? "someone";
}

function isRanker(guild: { rankerRoleId: string | null }, interaction: any) {
  const memberRoles: string[] = interaction.member?.roles ?? [];
  const hasRankerRole = !!guild.rankerRoleId && memberRoles.includes(guild.rankerRoleId);
  // Also allow anyone with server-wide Administrator, so an admin without
  // the ranker role assigned to themselves can still check the leaderboard.
  const permBits = BigInt(interaction.member?.permissions ?? "0");
  const isAdmin = (permBits & BigInt(0x8)) === BigInt(0x8);
  return hasRankerRole || isAdmin;
}

function hoursSince(date: Date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

// ── /setup, /help, /leaderboard ──────────────────────────────────────────
async function handleCommand(interaction: any) {
  const name = interaction.data.name;

  if (name === "setup") {
    const guildId = interaction.guild_id;
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: { ranks: true },
    });

    if (!guild || guild.ranks.length === 0) {
      return json({
        type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            "⚠️ This server hasn't been configured yet. Set it up in the dashboard first, " +
            "then run `/setup` again.",
          flags: MessageFlags.EPHEMERAL,
        },
      });
    }

    return json({
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [buildSetupEmbed(guild.ranks)],
        components: buildSetupComponents(),
      },
    });
  }

  if (name === "help") {
    return json({
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [
          {
            title: "TierUp — Commands",
            color: 0x2fa86f,
            fields: [
              { name: "/setup", value: "Admins only — posts the Get Ranked panel in this channel." },
              { name: "/leaderboard", value: "Rankers/admins only — shows ranker activity." },
              { name: "/help", value: "Shows this message." },
            ],
            description:
              "**How it works:** click **Get Ranked** on the panel → fill out the form → " +
              "a review thread is created → a ranker picks your tier (or denies it) → " +
              "you get a DM either way.\n\n" +
              "More detail: https://tierup.seeshaun.xyz/help",
            footer: { text: WATERMARK },
          },
        ],
        flags: MessageFlags.EPHEMERAL,
      },
    });
  }

  if (name === "leaderboard") {
    return await handleLeaderboard(interaction);
  }

  return json({
    type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Unknown command.", flags: MessageFlags.EPHEMERAL },
  });
}

async function handleLeaderboard(interaction: any) {
  const guildId = interaction.guild_id;
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });

  if (!isRanker(guild ?? { rankerRoleId: null }, interaction)) {
    return json({
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ Only rankers or admins can view the leaderboard.",
        flags: MessageFlags.EPHEMERAL,
      },
    });
  }

  const daysOption = interaction.data.options?.find((o: any) => o.name === "days")?.value as
    | number
    | undefined;
  const since = daysOption ? new Date(Date.now() - daysOption * 24 * 60 * 60 * 1000) : undefined;

  const reviewed = await prisma.application.findMany({
    where: {
      guildId,
      status: { in: ["PROMOTED", "DENIED"] },
      reviewerId: { not: null },
      ...(since ? { reviewedAt: { gte: since } } : {}),
    },
    select: { reviewerId: true, status: true, assignedRankLabel: true },
  });

  const byRanker = new Map<string, { promoted: number; denied: number }>();
  for (const r of reviewed) {
    const entry = byRanker.get(r.reviewerId!) ?? { promoted: 0, denied: 0 };
    if (r.status === "PROMOTED") entry.promoted++;
    else entry.denied++;
    byRanker.set(r.reviewerId!, entry);
  }
  const rankerRows = [...byRanker.entries()]
    .sort((a, b) => b[1].promoted + b[1].denied - (a[1].promoted + a[1].denied))
    .slice(0, 10);

  const byTier = new Map<string, number>();
  for (const r of reviewed) {
    if (r.status === "PROMOTED" && r.assignedRankLabel) {
      byTier.set(r.assignedRankLabel, (byTier.get(r.assignedRankLabel) ?? 0) + 1);
    }
  }
  const tierRows = [...byTier.entries()].sort((a, b) => b[1] - a[1]);

  const rangeLabel = daysOption ? `Last ${daysOption} day${daysOption === 1 ? "" : "s"}` : "All-time";

  const leaderboardText = rankerRows.length
    ? rankerRows
        .map(([reviewerId, r], i) => {
          const total = r.promoted + r.denied;
          return `**${i + 1}.** <@${reviewerId}> — ${total} reviewed (${r.promoted} promoted, ${r.denied} denied)`;
        })
        .join("\n")
    : "No reviews in this window.";

  const tierText = tierRows.length
    ? tierRows.map(([label, count]) => `**${label}** — ${count} assigned`).join("\n")
    : "No promotions in this window.";

  return json({
    type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: "📊 Ranker Leaderboard",
          color: 0x2fa86f,
          description: `**${rangeLabel}**`,
          fields: [
            { name: "Top rankers", value: leaderboardText },
            { name: "Rank distribution", value: tierText },
          ],
          footer: { text: WATERMARK },
        },
      ],
    },
  });
}

// ── Buttons ─────────────────────────────────────────────────────────────
async function handleComponent(interaction: any) {
  const customId: string = interaction.data.custom_id;

  if (customId === "get_ranked_button") {
    return await handleGetRankedButton(interaction);
  }
  if (customId.startsWith("rank:")) {
    return await handleRankButton(interaction, customId);
  }
  if (customId.startsWith("deny:")) {
    return await handleDenyButton(interaction, customId);
  }

  return json({
    type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Unknown button.", flags: MessageFlags.EPHEMERAL },
  });
}

async function handleGetRankedButton(interaction: any) {
  const guildId = interaction.guild_id;
  const applicantId = interaction.member.user.id;

  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { questions: { orderBy: { position: "asc" } } },
  });

  const latest = await prisma.application.findFirst({
    where: { guildId, applicantId },
    orderBy: { createdAt: "desc" },
  });

  if (latest?.status === "PENDING") {
    return json({
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "⏰ You already have a pending application — wait for it to be reviewed first.",
        flags: MessageFlags.EPHEMERAL,
      },
    });
  }

  const cooldownHours = guild?.reapplyCooldownHours ?? 24;
  if (latest?.status === "DENIED" && latest.reviewedAt && cooldownHours > 0) {
    const elapsed = hoursSince(latest.reviewedAt);
    if (elapsed < cooldownHours) {
      const remaining = Math.ceil(cooldownHours - elapsed);
      return json({
        type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `⏳ You can reapply in about ${remaining} hour${remaining === 1 ? "" : "s"}.`,
          flags: MessageFlags.EPHEMERAL,
        },
      });
    }
  }

  const questions = guild?.questions.length ? guild.questions : DEFAULT_QUESTIONS;

  return json({
    type: ResponseType.MODAL,
    data: {
      custom_id: "rank_application_modal",
      title: "Rank Application",
      components: questions.slice(0, 5).map((q) => ({
        type: 1,
        components: [
          {
            type: 4,
            custom_id: q.id,
            label: q.label,
            style: 1,
            placeholder: "placeholder" in q ? q.placeholder : undefined,
            required: true,
            max_length: 256,
          },
        ],
      })),
    },
  });
}

async function handleRankButton(interaction: any, customId: string) {
  const [, rankId, applicantId] = customId.split(":");
  const guildId = interaction.guild_id;

  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!isRanker(guild ?? { rankerRoleId: null }, interaction)) {
    return json({
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ You don't have permission to assign ranks. Only the ranker role can use these buttons.",
        flags: MessageFlags.EPHEMERAL,
      },
    });
  }

  const rank = await prisma.rank.findUnique({ where: { id: rankId } });
  if (!rank) {
    return json({
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "❌ That rank no longer exists in the config.", flags: MessageFlags.EPHEMERAL },
    });
  }

  const allRanks = await prisma.rank.findMany({ where: { guildId } });

  let roleAssignFailed = false;
  try {
    const member: any = await getGuildMember(guildId, applicantId);
    const currentRoles: string[] = member.roles ?? [];
    const otherRankRoleIds = allRanks.filter((r) => r.id !== rank.id).map((r) => r.roleId);
    const toRemove = currentRoles.filter((rid) => otherRankRoleIds.includes(rid));

    await Promise.allSettled(toRemove.map((rid) => removeRoleFromMember(guildId, applicantId, rid)));
    await addRoleToMember(guildId, applicantId, rank.roleId);
  } catch (err) {
    console.error("Failed to assign role:", err);
    roleAssignFailed = true;
  }

  const application = await prisma.application.findFirst({
    where: { guildId, threadId: interaction.channel_id, status: "PENDING" },
  });
  if (application) {
    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "PROMOTED",
        assignedRankLabel: rank.label,
        reviewerId: interaction.member.user.id,
        reviewedAt: new Date(),
      },
    });
  }

  const oldEmbed = interaction.message.embeds[0];
  const newEmbed = {
    ...oldEmbed,
    color: roleAssignFailed ? 0xed4245 : 0x2ecc71,
    fields: oldEmbed.fields.map((f: any) =>
      f.name === "Status"
        ? {
            ...f,
            value: roleAssignFailed
              ? `⚠️ Role assign failed — check bot permissions/role order (intended: **${rank.label}**)`
              : `✅ Assigned: **${rank.label}**`,
          }
        : f
    ),
    footer: { text: `Ranked by ${displayTag(interaction)} • ${oldEmbed.footer?.text ?? ""}` },
  };

  const responsePromise = json({
    type: ResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [newEmbed],
      components: buildRankButtonRows(allRanks, applicantId, true),
    },
  });

  if (!roleAssignFailed) {
    await sendMessage(interaction.channel_id, {
      content: `🎉 <@${applicantId}> has been ranked **${rank.label}** by <@${interaction.member.user.id}>!`,
    });

    try {
      await sendDM(applicantId, {
        content:
          `🎉 Your application in **${guild?.name ?? "the server"}** was reviewed — ` +
          `you were ranked **${rank.label}**!`,
      });
    } catch {
      // DMs closed — not fatal, the channel announcement above still covers it.
    }
  }

  return responsePromise;
}

async function handleDenyButton(interaction: any, customId: string) {
  const [, applicantId] = customId.split(":");
  const guildId = interaction.guild_id;

  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!isRanker(guild ?? { rankerRoleId: null }, interaction)) {
    return json({
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ You don't have permission to deny applications. Only the ranker role can use these buttons.",
        flags: MessageFlags.EPHEMERAL,
      },
    });
  }

  return json({
    type: ResponseType.MODAL,
    data: {
      custom_id: `deny_reason_modal:${applicantId}`,
      title: "Deny application",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "reason",
              label: "Reason (shown to the applicant)",
              style: 2,
              placeholder: "e.g. Needs more transitions, resubmit when ready.",
              required: false,
              max_length: 512,
            },
          ],
        },
      ],
    },
  });
}

// ── Modal submit ────────────────────────────────────────────────────────
async function handleModalSubmit(interaction: any) {
  const customId: string = interaction.data.custom_id;

  if (customId === "rank_application_modal") {
    return await handleApplicationSubmit(interaction);
  }
  if (customId.startsWith("deny_reason_modal:")) {
    return await handleDenySubmit(interaction, customId);
  }

  return json({
    type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Unknown form.", flags: MessageFlags.EPHEMERAL },
  });
}

async function handleApplicationSubmit(interaction: any) {
  const guildId = interaction.guild_id;
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { ranks: true, questions: { orderBy: { position: "asc" } } },
  });

  if (!guild?.forumChannelId) {
    return json({
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ No application forum channel is configured. Ask an admin to set one in the dashboard.",
        flags: MessageFlags.EPHEMERAL,
      },
    });
  }

  const questions = guild.questions.length ? guild.questions : DEFAULT_QUESTIONS;
  const submitted: Record<string, string> = {};
  for (const row of interaction.data.components) {
    const comp = row.components[0];
    submitted[comp.custom_id] = comp.value;
  }
  const answers = questions.map((q) => ({ label: q.label, value: submitted[q.id] ?? "" }));

  const user = interaction.member?.user ?? interaction.user;
  const applicantId: string = user.id;
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> BigInt(22)) % 6}.png`;

  const embed = buildApplicationEmbed({
    userId: applicantId,
    userMention: `<@${applicantId}>`,
    avatarUrl,
    answers,
    status: "⏰ Waiting for rank...",
    color: 0xf1c40f,
  });
  const components = buildRankButtonRows(guild.ranks, applicantId);

  const thread: any = await createThreadInForum(
    guild.forumChannelId,
    `${user.global_name ?? user.username}'s Application`,
    {
      content: "New rank application submitted!",
      embeds: [embed],
      components,
    }
  );

  await prisma.application.create({
    data: { guildId, applicantId, threadId: thread.id, status: "PENDING", answers },
  });

  const deleteAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  await prisma.pendingThreadDeletion.create({
    data: { guildId, channelId: thread.id, deleteAt },
  });

  await sendMessage(thread.id, {
    content:
      `📝 <@${applicantId}> has submitted a rank application!\n` +
      `⏰ This thread will be automatically deleted in 4 hours.`,
  });

  return json({
    type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content:
        `✅ Application submitted! <#${thread.id}>\n` +
        `⏰ This thread will be automatically deleted in 4 hours.\n` +
        `Please wait for a ranker to review your application.`,
      flags: MessageFlags.EPHEMERAL,
    },
  });
}

async function handleDenySubmit(interaction: any, customId: string) {
  const [, applicantId] = customId.split(":");
  const guildId = interaction.guild_id;
  const reason: string =
    interaction.data.components?.[0]?.components?.[0]?.value?.trim() || "No reason given.";

  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  const allRanks = await prisma.rank.findMany({ where: { guildId } });

  const application = await prisma.application.findFirst({
    where: { guildId, threadId: interaction.channel_id, status: "PENDING" },
  });
  if (application) {
    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "DENIED",
        reason,
        reviewerId: interaction.member.user.id,
        reviewedAt: new Date(),
      },
    });
  }

  try {
    await sendDM(applicantId, {
      content:
        `Your application in **${guild?.name ?? "the server"}** was reviewed and wasn't approved this time.\n` +
        `Reason: ${reason}`,
    });
  } catch {
    // DMs closed — not fatal.
  }

  await sendMessage(interaction.channel_id, {
    content: `❌ Application denied by <@${interaction.member.user.id}>.\nReason: ${reason}`,
  });

  const oldEmbed = interaction.message?.embeds?.[0];
  if (!oldEmbed) {
    return json({ type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Denied.", flags: MessageFlags.EPHEMERAL } });
  }

  const newEmbed = {
    ...oldEmbed,
    color: 0xed4245,
    fields: [
      ...oldEmbed.fields.filter((f: any) => f.name !== "Status" && f.name !== "Reason"),
      { name: "Status", value: "❌ Denied" },
      { name: "Reason", value: reason },
    ],
    footer: { text: `Denied by ${displayTag(interaction)} • ${oldEmbed.footer?.text ?? ""}` },
  };

  return json({
    type: ResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [newEmbed],
      components: buildRankButtonRows(allRanks, applicantId, true),
    },
  });
}
