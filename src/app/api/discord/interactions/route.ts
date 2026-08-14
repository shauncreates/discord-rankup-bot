import { verifyKey } from "discord-interactions";
import { prisma } from "@/lib/db";
import {
  addRoleToMember,
  createThreadInForum,
  editMessage,
  sendMessage,
} from "@/lib/discord-rest";
import {
  buildApplicationEmbed,
  buildRankButtonRows,
  buildSetupComponents,
  buildSetupEmbed,
  CHANNEL_TYPE_GUILD_FORUM,
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

// ── /setup ──────────────────────────────────────────────────────────────
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

  return json({
    type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Unknown command.", flags: MessageFlags.EPHEMERAL },
  });
}

// ── Buttons ─────────────────────────────────────────────────────────────
async function handleComponent(interaction: any) {
  const customId: string = interaction.data.custom_id;

  if (customId === "get_ranked_button") {
    return json({
      type: ResponseType.MODAL,
      data: {
        custom_id: "rank_application_modal",
        title: "Rank Application",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "edit_link",
                label: "Edit Link",
                style: 1,
                placeholder: "https://tiktok.com/...",
                required: true,
                max_length: 256,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "app_used",
                label: "App Used",
                style: 1,
                placeholder: "e.g., CapCut, Alight Motion, etc.",
                required: true,
                max_length: 128,
              },
            ],
          },
        ],
      },
    });
  }

  if (customId.startsWith("rank:")) {
    return await handleRankButton(interaction, customId);
  }

  return json({
    type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Unknown button.", flags: MessageFlags.EPHEMERAL },
  });
}

async function handleRankButton(interaction: any, customId: string) {
  const [, rankId, applicantId] = customId.split(":");
  const guildId = interaction.guild_id;

  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  const memberRoles: string[] = interaction.member?.roles ?? [];

  if (!guild?.rankerRoleId || !memberRoles.includes(guild.rankerRoleId)) {
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

  // Assign the Discord role. If this fails (missing perms / role hierarchy),
  // still update the message but let the ranker know.
  let roleAssignFailed = false;
  try {
    await addRoleToMember(guildId, applicantId, rank.roleId);
  } catch (err) {
    console.error("Failed to assign role:", err);
    roleAssignFailed = true;
  }

  const allRanks = await prisma.rank.findMany({ where: { guildId } });
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

  // Respond by editing the original message in place, with buttons disabled.
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
  }

  return responsePromise;
}

function displayTag(interaction: any) {
  const user = interaction.member?.user ?? interaction.user;
  return user?.global_name ?? user?.username ?? "someone";
}

// ── Modal submit (application form) ────────────────────────────────────
async function handleModalSubmit(interaction: any) {
  if (interaction.data.custom_id !== "rank_application_modal") {
    return json({
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Unknown form.", flags: MessageFlags.EPHEMERAL },
    });
  }

  const guildId = interaction.guild_id;
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { ranks: true },
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

  const fields: Record<string, string> = {};
  for (const row of interaction.data.components) {
    const comp = row.components[0];
    fields[comp.custom_id] = comp.value;
  }

  const user = interaction.member?.user ?? interaction.user;
  const applicantId: string = user.id;
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> 22n) % 6}.png`;

  const embed = buildApplicationEmbed({
    userId: applicantId,
    userMention: `<@${applicantId}>`,
    avatarUrl,
    editLink: fields.edit_link,
    appUsed: fields.app_used,
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

  // Schedule auto-deletion 4 hours from now (handled by the cron route,
  // since there's no long-running process to `sleep` here).
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
