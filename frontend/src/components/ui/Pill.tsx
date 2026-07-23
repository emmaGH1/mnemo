import Link from "next/link";

type PillProps = {
  href: string;
  children: React.ReactNode;
  variant?: "solid" | "outline";
  className?: string;
};

export default function Pill({
  href,
  children,
  variant = "solid",
  className = "",
}: PillProps) {
  const external = href.startsWith("http");
  const extra = external
    ? { target: "_blank", rel: "noreferrer" }
    : {};

  if (variant === "solid") {
    const cls = `inline-flex items-center gap-3 rounded-full bg-white py-2 pl-6 pr-2 text-base font-medium text-black transition-colors duration-150 hover:bg-white/90 ${className}`;
    const inner = (
      <>
        <span>{children}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 10L10 2M10 2H4.5M10 2V7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </>
    );
    return external ? (
      <a href={href} className={cls} {...extra}>
        {inner}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  const cls = `inline-flex items-center rounded-full border border-white/15 bg-white/10 px-6 py-2.5 text-base font-medium text-white transition-colors duration-150 hover:bg-white/15 ${className}`;
  return external ? (
    <a href={href} className={cls} {...extra}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
