import type { Metadata } from "next";
import { Analytics } from '@vercel/analytics/next';
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rank Up — Dashboard",
  description: "Configure rank buttons and ranker roles for the Rank Up bot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
