"use client";

import { useState } from "react";
import SectionHeader from "@/components/SectionHeader";

type Role = { id: string; name: string };
type Channel = { id: string; name: string };
type Emoji = { id: string; name: string; animated: boolean };
type RankRow = { label: string; roleId: string; emoji: string | null };

export default function RankConfigEditor({
  guildId,
  guildName,
  roles,
  forumChannels,
  emojis,
  initial,
}: {
  guildId: string;
  guildName: string;
  roles: Role[];
  forumChannels: Channel[];
  emojis: Emoji[];
  initial: { rankerRoleId: string | null; forumChannelId: string | null; ranks: RankRow[] };
}) {
  const [rankerRoleId, setRankerRoleId] = useState(initial.rankerRoleId ?? "");
  const [forumChannelId, setForumChannelId] = useState(initial.forumChannelId ?? "");
  const [ranks, setRanks] = useState<RankRow[]>(
    initial.ranks.length ? initial.ranks : [{ label: "", roleId: "", emoji: "" }]
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function updateRank(index: number, patch: Partial<RankRow>) {
    setRanks((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRank() {
    setRanks((prev) => [...prev, { label: "", roleId: "", emoji: "" }]);
  }

  function removeRank(index: number) {
    setRanks((prev) => prev.filter((_, i) => i !== index));
  }

  function moveRank(index: number, dir: -1 | 1) {
    setRanks((prev) => {
      const next = prev.slice();
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setStatus("saving");
    setErrorMsg("");

    const cleanRanks = ranks
      .filter((r) => r.label.trim() && r.roleId)
      .map((r) => ({ ...r, emoji: r.emoji?.trim() || null }));

    const res = await fetch(`/api/guilds/${guildId}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rankerRoleId: rankerRoleId || null,
        forumChannelId: forumChannelId || null,
        guildName,
        ranks: cleanRanks,
      }),
    });

    if (res.ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
      setErrorMsg(await res.text());
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card bg-panel p-5">
        <SectionHeader
          icon="🛡️"
          title="Ranker role"
          subtitle="Members with this role can click the rank buttons and promote applicants."
        />
        <select
          value={rankerRoleId}
          onChange={(e) => setRankerRoleId(e.target.value)}
          className="w-full bg-base rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Select a role…</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </section>

      <section className="card bg-panel p-5">
        <SectionHeader
          icon="💬"
          title="Application forum"
          subtitle={'The forum channel where "Get Ranked" applications turn into threads.'}
        />
        <select
          value={forumChannelId}
          onChange={(e) => setForumChannelId(e.target.value)}
          className="w-full bg-base rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Select a forum channel…</option>
          {forumChannels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        {forumChannels.length === 0 && (
          <p className="text-yellow-500/80 text-sm mt-2">
            No forum channels found in this server yet — create one in Discord first.
          </p>
        )}
      </section>

      <section className="card bg-panel p-5">
        <SectionHeader
          icon="🏆"
          title="Rank tiers"
          subtitle="Highest rank first. Each becomes a button; picking one assigns the linked role."
        />

        <div className="flex flex-col gap-2">
          {ranks.map((rank, i) => (
            <div key={i} className="card flex items-center gap-2 bg-base p-2">
              <div className="flex flex-col gap-0.5 pl-1">
                <button
                  onClick={() => moveRank(i, -1)}
                  disabled={i === 0}
                  className="text-white/30 hover:text-brand-light disabled:opacity-20 text-xs leading-none"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveRank(i, 1)}
                  disabled={i === ranks.length - 1}
                  className="text-white/30 hover:text-brand-light disabled:opacity-20 text-xs leading-none"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>

              <select
                value={rank.emoji ?? ""}
                onChange={(e) => updateRank(i, { emoji: e.target.value || null })}
                className="w-40 bg-panel rounded-md px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">No emoji</option>
                {emojis.map((e) => (
                  <option key={e.id} value={`<${e.animated ? "a" : ""}:${e.name}:${e.id}>`}>
                    :{e.name}:
                  </option>
                ))}
              </select>
              <input
                placeholder="Label, e.g. Gold Editor"
                value={rank.label}
                onChange={(e) => updateRank(i, { label: e.target.value })}
                className="flex-1 bg-panel rounded-md px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
              <select
                value={rank.roleId}
                onChange={(e) => updateRank(i, { roleId: e.target.value })}
                className="w-40 bg-panel rounded-md px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">Role…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeRank(i)}
                className="text-white/40 hover:text-red-400 px-2"
                aria-label="Remove rank"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRank}
          className="mt-3 text-sm text-brand hover:text-brand-light transition"
        >
          + Add rank tier
        </button>
        {emojis.length === 0 && (
          <p className="text-white/30 text-xs mt-2">
            No custom emojis found in this server — the emoji dropdown will just show "No emoji"
            until you upload some in Discord.
          </p>
        )}
      </section>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={status === "saving"}
          className="bg-brand hover:brightness-110 transition rounded-lg px-5 py-2.5 font-medium disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && <span className="text-brand-light text-sm">Saved ✓</span>}
        {status === "error" && <span className="text-red-400 text-sm">{errorMsg || "Failed to save"}</span>}
      </div>

      <p className="text-white/30 text-xs">
        After saving, run <code>/setup</code> in the forum channel (or wherever you want the
        "Get Ranked" panel) to post or refresh the button.
      </p>
    </div>
  );
}
