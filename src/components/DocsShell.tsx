import Link from "next/link";
import Logo from "@/components/Logo";

type NavSection = { heading: string; items: { href: string; label: string }[] };

const NAV: NavSection[] = [
  {
    heading: "Overview",
    items: [
      { href: "/help", label: "Commands" },
      { href: "/status", label: "Status" },
    ],
  },
];

export default function DocsShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row max-w-6xl mx-auto">
      <aside className="md:w-56 shrink-0 px-6 py-8 md:border-r border-white/5">
        <Link href="/" className="block mb-8">
          <Logo />
        </Link>
        {NAV.map((section) => (
          <div key={section.heading} className="mb-6">
            <h3 className="text-xs uppercase tracking-wide text-white/30 mb-2">
              {section.heading}
            </h3>
            <div className="flex flex-col gap-1">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "rounded-md px-2.5 py-1.5 text-sm transition " +
                    (active === item.href
                      ? "bg-brand/15 text-brand-light"
                      : "text-white/60 hover:text-white hover:bg-panel/60")
                  }
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <main className="flex-1 px-6 py-8 max-w-2xl">{children}</main>
    </div>
  );
}
