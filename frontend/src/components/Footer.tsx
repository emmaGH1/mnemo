import Link from "next/link";
import Logo from "./ui/Logo";

const links = [
  ["Workspace", "/"],
  ["Demo project", "/projects/lore-olympus"],
  ["Reader preview", "/reader"],
  ["Creator digest", "/digest"],
] as const;

export default function Footer() {
  return (
    <footer className="border-t border-white/8 bg-[#030504]">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
          <div>
            <Link href="/" aria-label="Mnemo workspace" className="inline-flex">
              <Logo size={28} withWordmark />
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/40">
              Reader-relative spoiler protection for serialized-fiction communities.
            </p>
          </div>

          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3">
            {links.map(([label, href]) => (
              <Link key={label} href={href} className="text-sm text-white/45 transition hover:text-white">
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-white/8 pt-6 text-xs text-white/25 sm:flex-row">
          <p>© {new Date().getFullYear()} Mnemo</p>
          <p>Seeded demo · genuine cached Mind verdicts</p>
        </div>
      </div>
    </footer>
  );
}
