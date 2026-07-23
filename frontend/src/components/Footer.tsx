import Link from "next/link";
import Logo from "./ui/Logo";

const links: [string, string][] = [
  ["Twitter", "https://x.com/mnemohq"],
  // TODO: confirm the real contact address — placeholder below
  ["Gmail", "mailto:hi@mnemo.app"],
  ["Pricing", "#pricing"],
  ["GitHub", "https://github.com/mnemo"],
  ["OKX listing", "https://www.okx.ai/agents/6211"],
];

export default function Footer() {
  return (
    <footer className="border-t border-white/8 px-5 py-16 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 md:flex-row md:items-center md:justify-between">
        <Link href="/" aria-label="Mnemo home" className="flex items-center">
          <Logo size={28} withWordmark />
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:justify-end">
          {links.map(([label, href]) => {
            const external = href.startsWith("http");
            return (
              <Link
                key={label}
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
                className="font-mono-statement text-[13px] uppercase tracking-wider text-white/50 transition-colors duration-150 hover:text-white"
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
