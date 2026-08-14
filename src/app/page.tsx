import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LoginButton from "@/components/LoginButton";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blurple flex items-center justify-center text-2xl">
        🏆
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Rank Up</h1>
        <p className="text-white/50 mt-2 max-w-sm">
          Configure the rank tiers, roles, and rankers for each server the bot is in — no code edits needed.
        </p>
      </div>
      <LoginButton />
    </main>
  );
}
