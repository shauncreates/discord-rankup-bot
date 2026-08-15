import type { Metadata } from "next";
import Providers from "@/components/Providers";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rank Up — Dashboard",
  description: "Configure rank buttons and ranker roles for the Rank Up bot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}