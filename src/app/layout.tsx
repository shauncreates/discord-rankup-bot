import type { Metadata } from "next";
import Providers from "@/components/Providers";
import Footer from "@/components/Footer";
import ParticleBackground from "@/components/ParticleBackground";
import "./globals.css";

export const metadata: Metadata = {
  title: "TierUp — Dashboard",
  description: "Configure rank buttons and ranker roles for the TierUp bot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ParticleBackground />
        <Providers>
          <div className="relative z-10 min-h-screen flex flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
