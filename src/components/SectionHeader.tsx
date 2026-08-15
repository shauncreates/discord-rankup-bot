export default function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <span className="w-1 self-stretch rounded-full bg-brand shrink-0" aria-hidden="true" />
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <span aria-hidden="true">{icon}</span>
          {title}
        </h2>
        {subtitle && <p className="text-white/50 text-sm mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
