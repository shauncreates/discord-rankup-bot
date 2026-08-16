// Pure helpers for building embed/component JSON. Kept separate from the
// route handler so they're easy to unit test / reuse.

import type { Rank } from "@prisma/client";

export const CHANNEL_TYPE_GUILD_FORUM = 15;
export const CHANNEL_TYPE_PUBLIC_THREAD = 11;

// Change this to whatever you want shown — a name, a handle, a small tagline.
// Every embed's footer appends this, so it only needs updating in one place.
export const WATERMARK = "© seeshaun 2026";

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
    footer: { text: `Select the button below to begin your submission. • ${WATERMARK}` },
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
  answers: { label: string; value: string }[];
  status: string;
  color: number;
  footerExtra?: string;
  reason?: string | null;
}) {
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "User", value: opts.userMention },
    ...opts.answers.map((a) => ({ name: a.label, value: a.value.slice(0, 1024) || "—" })),
    { name: "Status", value: opts.status },
  ];
  if (opts.reason) {
    fields.push({ name: "Reason", value: opts.reason.slice(0, 1024) });
  }

  return {
    title: "Rank Application",
    color: opts.color,
    thumbnail: { url: opts.avatarUrl },
    fields,
    footer: {
      text: opts.footerExtra
        ? `${opts.footerExtra} • Applicant ID: ${opts.userId} • ${WATERMARK}`
        : `Applicant ID: ${opts.userId} • ${WATERMARK}`,
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

  // Deny gets its own row so it never gets mixed in with rank tier buttons.
  rows.push({
    type: 1,
    components: [
      {
        type: 2,
        style: 4, // danger
        label: "Deny",
        custom_id: `deny:${applicantId}`,
        emoji: { name: "✖️" },
        disabled,
      },
    ],
  });

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
