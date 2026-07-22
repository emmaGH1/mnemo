import Link from "next/link";

const links: [string, string][] = [
  ["Docs", "#api"],
  ["Pricing", "#use"],
  ["Blog", "#"],
  ["Discord", "https://discord.gg/mnemo"],
  ["Twitter", "https://x.com/mnemo"],
  ["GitHub", "https://github.com/mnemo"],
];

export default function Footer() {
  return (
    <footer className="border-t border-white/8 px-5 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-10 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-with-name.jpg"
              alt="Mnemo"
              className="mx-auto h-7 w-auto md:mx-0"
            />
            <p className="mt-3 text-sm text-white/85">
              Continuity for webtoon artists.
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:justify-end">
            {links.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="text-sm text-white/40 transition-colors duration-150 hover:text-white"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-10 text-center text-sm text-white/40 md:text-left">
          Listed on OKX.AI as Agent 6211.{" "}
          <a
            href="https://www.okx.ai/agents/6211"
            target="_blank"
            rel="noreferrer"
            className="text-white/60 transition-colors duration-150 hover:text-white"
          >
            View listing ↗
          </a>
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 border-t border-white/8 pt-8 text-sm text-white/40 sm:flex-row sm:justify-between">
          <span>© 2026 Mnemo</span>
          <span>
            <Link
              href="#"
              className="transition-colors duration-150 hover:text-white"
            >
              Terms
            </Link>
            <span className="mx-3 text-white/20">·</span>
            <Link
              href="#"
              className="transition-colors duration-150 hover:text-white"
            >
              Privacy
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
