import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#2fa86f", // primary accent — buttons, links, focus rings
        "brand-light": "#7fe8b3", // hover/highlight accent
        panel: "#161f1b", // card/input backgrounds — green-tinted dark
        base: "#0e1512", // page background — green-tinted near-black
      },
    },
  },
  plugins: [],
} satisfies Config;
