"use client";

import { signIn } from "next-auth/react";

export default function LoginButton() {
  return (
    <button
      onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
      className="bg-blurple hover:brightness-110 transition rounded-lg px-5 py-2.5 font-medium"
    >
      Log in with Discord
    </button>
  );
}
