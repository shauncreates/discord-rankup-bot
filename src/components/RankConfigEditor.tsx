"use client";

import { useState } from "react";
import SectionHeader from "@/components/SectionHeader";

type Role = { id: string; name: string };
type Channel = { id: string; name: string };
type Emoji = { id: string; name: string; animated: boolean };
type EmojiSource = "custom" | "unicode";
type RankRow = { label: string; roleId: string; emoji: string | null; emojiSource: EmojiSource };

const CUSTOM_EMOJI_RE = /^<a?:[a-zA-Z0-9_]+:\d+>$/;

function blankRank(): RankRow {
  return { label: "", roleId: "", emoji: "", emojiSource: "custom" };
}

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
  initial: {
    rankerRoleId: string | null;
    forumChannelId: string | null;
    reapplyCooldownHours: number;
    ranks: { label: string; roleId: string; emoji: string | null }[];
    questions: { label: string }[];
  };
}) {
  const [rankerRoleId, setRankerRoleId] = useState(initial.rankerRoleId ?? "");
  const [forumChannelId, setForumChannelId] = useState(initial.forumChannelId ?? "");
  const [cooldownHours, setCooldownHours] = useState(initial.reapplyCooldownHours ?? 24);
  const [questions, setQuestions] = useState<string[]>(
    initial.questions.length ? initial.questions.map((q) => q.label) : ["Edit Link", "App Used"]
  );
  const [ranks, setRanks] = useState<RankRow[]>(
    initial.ranks.length
      ? initial.ranks.map((r) => ({
          ...r,
          emojiSource: r.emoji && CUSTOM_EMOJI_RE.test(r.emoji) ? "custom" : "unicode",
        }))
      : [blankRank()]
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function updateRank(index: number, patch: Partial<RankRow>) {
    setRanks((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRank() {
    setRanks((prev) => [...prev, blankRank()]);
  }

  function removeRank(index: number) {
    setRanks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(targetIndex: number) {
    setRanks((prev) => {
      if (dragIndex === null || dragIndex === targetIndex) return prev;
      const next = prev.slice();
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setOverIndex(null);
  }

  async function save() {
    setStatus("saving");
    setErrorMsg("");

    const cleanRanks = ranks
      .filter((r) => r.label.trim() && r.roleId)
      .map((r) => ({ label: r.label, roleId: r.roleId, emoji: r.emoji?.trim() || null }));

    const res = await fetch(`/api/guilds/${guildId}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rankerRoleId: rankerRoleId || null,
        forumChannelId: forumChannelId || null,
        guildName,
        reapplyCooldownHours: cooldownHours,
        ranks: cleanRanks,
        questions: questions.filter((q) => q.trim()).map((label) => ({ label })),
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
          icon="📝"
          title="Application questions"
          subtitle="Up to 3 fields shown in the form when someone clicks Get Ranked."
        />
        <div className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) =>
                  setQuestions((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                }
                placeholder="e.g. Portfolio Link"
                className="flex-1 bg-base rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
              <button
                onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-white/40 hover:text-red-400 px-2"
                aria-label="Remove question"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {questions.length < 3 && (
          <button
            onClick={() => setQuestions((prev) => [...prev, ""])}
            className="mt-3 text-sm text-brand hover:text-brand-light transition"
          >
            + Add question
          </button>
        )}
      </section>

      <section className="card bg-panel p-5">
        <SectionHeader
          icon="⏳"
          title="Reapply cooldown"
          subtitle="How long a denied applicant must wait before applying again. Set to 0 to disable."
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={cooldownHours}
            onChange={(e) => setCooldownHours(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 bg-base rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          <span className="text-white/50 text-sm">hours</span>
        </div>
      </section>

      <section className="card bg-panel p-5">
        <SectionHeader
          icon="🏆"
          title="Rank tiers"
          subtitle="Highest rank first. Each becomes a button; picking one assigns the linked role."
        />

        <div className="flex flex-col gap-2">
          {ranks.map((rank, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(i);
              }}
              onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={
                "card flex items-center gap-2 bg-base p-2 " +
                (dragIndex === i ? "opacity-40 " : "") +
                (overIndex === i && dragIndex !== i ? "border-brand" : "")
              }
            >
              <span
                className="text-white/30 cursor-grab active:cursor-grabbing select-none px-1 leading-none"
                aria-hidden="true"
                title="Drag to reorder"
              >
                ⠿
              </span>

              <div className="flex flex-col gap-1 w-32 shrink-0">
                <div className="flex text-[10px] rounded overflow-hidden border border-white/10 w-fit">
                  <button
                    type="button"
                    onClick={() => updateRank(i, { emojiSource: "custom", emoji: "" })}
                    className={
                      "px-2 py-0.5 " +
                      (rank.emojiSource === "custom" ? "bg-brand/30 text-brand-light" : "text-white/40")
                    }
                  >
                    Server
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRank(i, { emojiSource: "unicode", emoji: "" })}
                    className={
                      "px-2 py-0.5 " +
                      (rank.emojiSource === "unicode" ? "bg-brand/30 text-brand-light" : "text-white/40")
                    }
                  >
                    Unicode
                  </button>
                </div>
                {rank.emojiSource === "custom" ? (
                  <select
                    value={rank.emoji ?? ""}
                    onChange={(e) => updateRank(i, { emoji: e.target.value || null })}
                    className="w-full bg-panel rounded-md px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">No emoji</option>
                    {emojis.map((e) => (
                      <option key={e.id} value={`<${e.animated ? "a" : ""}:${e.name}:${e.id}>`}>
                        :{e.name}:
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    placeholder="🏆"
                    value={rank.emoji ?? ""}
                    onChange={(e) => updateRank(i, { emoji: e.target.value })}
                    className="w-full bg-panel rounded-md px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                  />
                )}
              </div>

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
