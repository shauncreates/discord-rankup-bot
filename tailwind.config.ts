import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blurple: "#5865F2",
        panel: "#1e1f24",
        base: "#15161a",
      },
    },
  },
  plugins: [],
} satisfies Config;
