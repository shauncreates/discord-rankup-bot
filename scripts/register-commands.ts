import { config } from "dotenv";
config({ path: ".env.local" });

// Run this once (and again any time you change command definitions):
//   npm run register-commands
//
// Registers commands globally (takes up to ~1hr to propagate). For instant
// testing in one server during development, swap the URL to the guild-scoped
// endpoint instead — see the commented line below.

const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APPLICATION_ID || !BOT_TOKEN) {
  console.error("Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN in your environment.");
  process.exit(1);
}

const commands = [
  {
    name: "setup",
    description: "Post the rank application panel in this channel.",
    default_member_permissions: String(1 << 3), // ADMINISTRATOR
  },
  {
    name: "help",
    description: "Show available commands and how ranking works.",
    // No default_member_permissions — everyone can use this one.
  },
];

async function main() {
  const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;
  // For a single test server instead of global rollout, use:
  // const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    console.error(`Failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  console.log("✅ Commands registered:", await res.json());
}

main();
