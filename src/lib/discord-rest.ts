// Thin wrapper around Discord's REST API using the bot token.
// We never open a gateway/WebSocket connection — every action here is a
// plain HTTPS call, which is why this can run from a Vercel serverless
// function instead of a long-running process.

const API_BASE = "https://discord.com/api/v10";

function botHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function discordFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...botHeaders(), ...(init.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord API ${init.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }

  // Some endpoints (e.g. add role, delete thread) return 204 No Content.
  if (res.status === 204) return null;
  return res.json();
}

export function createThreadInForum(
  channelId: string,
  name: string,
  message: { embeds?: any[]; components?: any[]; content?: string }
) {
  return discordFetch(`/channels/${channelId}/threads`, {
    method: "POST",
    body: JSON.stringify({
      name,
      message,
      auto_archive_duration: 1440,
    }),
  });
}

export function sendMessage(
  channelId: string,
  message: { content?: string; embeds?: any[]; components?: any[] }
) {
  return discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(message),
  });
}

export function editMessage(
  channelId: string,
  messageId: string,
  message: { embeds?: any[]; components?: any[] }
) {
  return discordFetch(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify(message),
  });
}

export function addRoleToMember(guildId: string, userId: string, roleId: string) {
  return discordFetch(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: "PUT",
  });
}

export function removeRoleFromMember(guildId: string, userId: string, roleId: string) {
  return discordFetch(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: "DELETE",
  });
}

export function getGuildMember(guildId: string, userId: string) {
  return discordFetch(`/guilds/${guildId}/members/${userId}`);
}

// DMs require opening a DM channel first, then sending into it like any
// other channel. Wrap calls to this in try/catch — users with DMs closed
// to the bot will make this fail, and that should never block the rest of
// the ranking flow.
async function createDM(userId: string) {
  return discordFetch(`/users/@me/channels`, {
    method: "POST",
    body: JSON.stringify({ recipient_id: userId }),
  });
}

export async function sendDM(userId: string, message: { content?: string; embeds?: any[] }) {
  const dm: any = await createDM(userId);
  return sendMessage(dm.id, message);
}

export function deleteChannel(channelId: string) {
  return discordFetch(`/channels/${channelId}`, { method: "DELETE" });
}

export function getGuildRoles(guildId: string) {
  return discordFetch(`/guilds/${guildId}/roles`);
}

export function getGuildEmojis(guildId: string) {
  return discordFetch(`/guilds/${guildId}/emojis`);
}

export function getGuildChannels(guildId: string) {
  return discordFetch(`/guilds/${guildId}/channels`);
}

export function getGuild(guildId: string) {
  return discordFetch(`/guilds/${guildId}`);
}

// Guilds the *bot* is a member of (used to intersect with the guilds the
// logged-in dashboard user administers, so we only ever show servers where
// both the bot is present and the user has rights to configure it).
export function getBotGuilds() {
  return discordFetch(`/users/@me/guilds?limit=200`);
}