import type { AuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const ADMINISTRATOR = 0x8;

export const authOptions: AuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify guilds" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the user's OAuth access token so we can call the Discord
      // API on their behalf later (to list servers they administer).
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      return session;
    },
  },
};

// Guilds the logged-in user has ADMINISTRATOR on, per Discord's OAuth
// "guilds" scope (returns a permissions bitfield per guild as a string).
export async function getUserAdminGuilds(accessToken: string) {
  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch user guilds: ${res.status}`);

  const guilds: any[] = await res.json();
  return guilds.filter((g) => (BigInt(g.permissions) & BigInt(ADMINISTRATOR)) === BigInt(ADMINISTRATOR));
}

export async function userHasGuildAccess(accessToken: string, guildId: string) {
  const guilds = await getUserAdminGuilds(accessToken);
  return guilds.some((g) => g.id === guildId);
}
