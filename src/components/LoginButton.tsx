"use client";

import { signIn } from "next-auth/react";

export default function LoginButton({
  label = "Log in with Discord",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <button
      onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
      className={
        compact
          ? "px-4 py-1.5 text-white hover:text-brand-light transition"
          : "bg-brand hover:brightness-110 transition rounded-lg px-5 py-2.5 font-medium"
      }
    >
      {label}
    </button>
  );
}
