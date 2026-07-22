type CardProps = {
  label?: string;
  right?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Card({
  label,
  right,
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/8 bg-black p-5 transition-colors duration-150 hover:border-white/15 ${className}`}
    >
      {(label || right) && (
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-white/50">
            {label}
          </span>
          <span className="font-mono text-xs text-white/40">{right}</span>
        </div>
      )}
      {children}
    </div>
  );
}
