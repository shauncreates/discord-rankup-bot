// Pure helpers for building embed/component JSON. Kept separate from the
// route handler so they're easy to unit test / reuse.

import type { Rank } from "@prisma/client";

export const CHANNEL_TYPE_GUILD_FORUM = 15;
export const CHANNEL_TYPE_PUBLIC_THREAD = 11;

export function buildSetupEmbed(ranks: Rank[]) {
  const lines = ranks
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => `${r.emoji ?? "•"} ${r.label}`)
    .join("\n");

  return {
    title: "GET RANKED!",
    description:
      "Click the button below to fill out your submission.\n\n" +
      "**Rank Tiers** (Highest → Lowest)\n" +
      lines,
    color: 0x1f8b4c,
    footer: { text: "Select the button below to begin your submission." },
  };
}

export function buildSetupComponents() {
  return [
    {
      type: 1, // action row
      components: [
        {
          type: 2, // button
          style: 1, // primary
          label: "Get Ranked",
          custom_id: "get_ranked_button",
          emoji: { name: "🏆" },
        },
      ],
    },
  ];
}

export function buildApplicationEmbed(opts: {
  userId: string;
  userMention: string;
  avatarUrl: string;
  editLink: string;
  appUsed: string;
  status: string;
  color: number;
  footerExtra?: string;
}) {
  return {
    title: "Rank Application",
    color: opts.color,
    thumbnail: { url: opts.avatarUrl },
    fields: [
      { name: "User", value: opts.userMention, inline: false },
      { name: "Edit Link", value: `[Click here](${opts.editLink})`, inline: false },
      { name: "App Used", value: opts.appUsed, inline: false },
      { name: "Status", value: opts.status, inline: false },
    ],
    footer: {
      text: opts.footerExtra
        ? `${opts.footerExtra} • Applicant ID: ${opts.userId}`
        : `Applicant ID: ${opts.userId}`,
    },
  };
}

export function buildRankButtonRows(ranks: Rank[], applicantId: string, disabled = false) {
  const sorted = ranks.slice().sort((a, b) => a.position - b.position);
  const rows: any[] = [];

  for (let i = 0; i < sorted.length; i += 5) {
    const chunk = sorted.slice(i, i + 5);
    rows.push({
      type: 1,
      components: chunk.map((rank) => ({
        type: 2,
        style: 2, // secondary
        label: rank.label,
        custom_id: `rank:${rank.id}:${applicantId}`,
        emoji: rank.emoji ? parseEmoji(rank.emoji) : undefined,
        disabled,
      })),
    });
  }

  return rows;
}

// Accepts either a plain unicode emoji ("🏆") or Discord custom emoji
// markup ("<:name:id>" / "<a:name:id>") and returns the component emoji shape.
function parseEmoji(raw: string) {
  const match = raw.match(/^<(a?):([a-zA-Z0-9_]+):(\d+)>$/);
  if (match) {
    const [, animated, name, id] = match;
    return { id, name, animated: animated === "a" };
  }
  return { name: raw };
}
