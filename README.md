# Rank Up — multi-server dashboard edition

A rewrite of the original discord.py gateway bot as an HTTP-based Discord app
(Interactions Endpoint), so the whole thing — bot + dashboard — runs on
Vercel with no always-on server.

## How it's different from the old bot.py

| | Old (discord.py) | New (this project) |
|---|---|---|
| Connection to Discord | Persistent WebSocket ("gateway") | Discord POSTs each interaction to an HTTP endpoint |
| Config | Hardcoded role/emoji IDs in `bot.py` | Stored per-server in Postgres, edited from the dashboard |
| Multi-server | Same hardcoded ranks for every server | Each server has its own ranks/roles/forum channel |
| 4hr thread auto-delete | `asyncio.sleep()` in memory | A due-date row in the DB + a Vercel Cron job that sweeps every 15 min |
| Hosting | Needs an always-on process | 100% serverless, deploys to Vercel |

## One-time setup

### 1. Discord application

Go to the [Discord Developer Portal](https://discord.com/developers/applications) →
your application (or create one).

- **Bot** tab: copy the bot token → `DISCORD_BOT_TOKEN`. Enable
  "Server Members Intent" if you want it, though this HTTP-based bot doesn't
  actually need gateway intents since it never connects to the gateway.
- **General Information** tab: copy the Application ID → `DISCORD_APPLICATION_ID`,
  and the Public Key → `DISCORD_PUBLIC_KEY`.
- **OAuth2** tab: copy Client ID / Client Secret → `DISCORD_CLIENT_ID` /
  `DISCORD_CLIENT_SECRET`. Add a redirect URL:
  `https://<your-vercel-domain>/api/auth/callback/discord`
  (and `http://localhost:3000/api/auth/callback/discord` for local dev).

You will come back to the **General Information** tab after deploying, to set
**Interactions Endpoint URL** to:
`https://<your-vercel-domain>/api/discord/interactions`
Discord verifies this URL by sending it a signed ping — it'll only save if
your deployment is live and `DISCORD_PUBLIC_KEY` is set correctly.

### 2. Database (Neon)

1. Create a free project at [neon.tech](https://neon.tech).
2. From your project, copy the pooled connection string → `DATABASE_URL`,
   and the direct (unpooled) connection string → `DIRECT_URL`. Neon shows
   both on the connection details page.
3. Easiest path: in Vercel, add the **Neon** integration from the Marketplace
   to your project — it creates the DB and sets both env vars for you.

### 3. Local install

```bash
npm install
cp .env.example .env.local   # fill in the values above
npx prisma migrate dev --name init
npm run register-commands    # registers the /setup slash command
```

### 4. Deploy

```bash
npx vercel        # first deploy / link project
npx vercel --prod
```

Add all the same env vars from `.env.example` in the Vercel project settings
(Production + Preview). Set `NEXTAUTH_URL` to your real domain.

After the first deploy, go back to Discord Developer Portal → your app →
General Information → set the **Interactions Endpoint URL** as described
above.

### 5. Invite the bot + configure a server

1. Log in to the dashboard with Discord.
2. If a server you admin isn't listed under "manageable", use the invite
   link shown under "bot not added yet" (needs Manage Roles, Send Messages,
   Create/Manage Threads — adjust the permission integer in
   `src/app/dashboard/page.tsx` if you need more/less).
3. Open the server, set the **ranker role**, the **application forum
   channel**, and add your rank tiers (label, emoji, linked role) top to
   bottom, highest first.
4. Save, then run `/setup` in Discord in whichever channel you want the
   "Get Ranked" panel posted.

## Notes / things worth knowing

- **Role hierarchy still matters.** The bot can only assign roles positioned
  below its own highest role in Server Settings → Roles, same as before.
- **Cron cadence** is every 15 minutes (`vercel.json`), so a thread might
  live up to ~15 min past its exact 4-hour mark — tighten the schedule if you
  need it exact (Vercel's free tier cron minimum is 1/day; paid plans allow
  more frequent schedules).
- **Global vs guild-scoped commands**: `register-commands.ts` registers
  `/setup` globally, which can take up to an hour to show up everywhere the
  first time. For instant testing in one server while developing, swap in
  the guild-scoped URL (commented in the script).
- This intentionally keeps the same UX as the original bot (modal → forum
  thread → rank buttons → role assignment), just config-driven instead of
  hardcoded, and HTTP-driven instead of gateway-driven.
