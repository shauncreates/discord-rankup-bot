import DocsShell from "@/components/DocsShell";
import SectionHeader from "@/components/SectionHeader";

const COMMANDS = [
  {
    name: "/setup",
    permission: "Admins only",
    description:
      'Posts the "Get Ranked" panel in the current channel, listing every configured rank tier with a button members click to apply.',
  },
  {
    name: "/help",
    permission: "Everyone",
    description: "Shows this same command list and a quick explanation of how ranking works, right inside Discord.",
  },
];

export default function HelpPage() {
  return (
    <DocsShell active="/help">
      <h1 className="text-3xl font-semibold mb-2">Commands</h1>
      <p className="text-white/50 mb-8">
        Everything TierUp responds to, and how the ranking flow works end to end.
      </p>

      <div className="flex flex-col gap-3 mb-12">
        {COMMANDS.map((cmd) => (
          <div key={cmd.name} className="card bg-panel p-4">
            <div className="flex items-center justify-between">
              <code className="text-brand-light font-medium">{cmd.name}</code>
              <span className="text-xs text-white/40">{cmd.permission}</span>
            </div>
            <p className="text-white/60 text-sm mt-2">{cmd.description}</p>
          </div>
        ))}
      </div>

      <SectionHeader icon="🏆" title="How ranking works" />
      <ol className="flex flex-col gap-4 text-white/70 text-sm mt-4">
        <li className="card bg-panel p-4">
          <span className="text-brand-light font-medium">1. An admin runs /setup</span> in a text
          channel. This posts the rank tier panel with a "Get Ranked" button.
        </li>
        <li className="card bg-panel p-4">
          <span className="text-brand-light font-medium">2. A member clicks the button</span> and
          fills out a short form with a link to their work and what they used to make it.
        </li>
        <li className="card bg-panel p-4">
          <span className="text-brand-light font-medium">3. A thread is created</span> in the
          server's application forum channel, where reviewers ("rankers") can see the submission.
        </li>
        <li className="card bg-panel p-4">
          <span className="text-brand-light font-medium">4. A ranker picks a tier</span> from the
          buttons on the thread. That assigns the matching Discord role automatically.
        </li>
      </ol>

      <p className="text-white/30 text-xs mt-10">
        Server admins configure rank tiers, the ranker role, and the application channel from the{" "}
        <a href="/dashboard" className="text-brand hover:text-brand-light">
          dashboard
        </a>
        .
      </p>
    </DocsShell>
  );
}
