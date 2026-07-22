"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./ui/Logo";
import Pill from "./ui/Pill";
import MobileMenu from "./MobileMenu";
import { OKX_AGENT_URL } from "@/config";

const links = [
  { label: "How to use", href: "#use" },
  { label: "In action", href: "#watch" },
  { label: "Docs", href: "#api" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-white/8 bg-black/70 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
          <Link href="/" aria-label="Mnemo home" className="flex items-center">
            <Logo size={20} withWordmark />
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-[15px] font-medium text-white/70 transition-colors hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Pill href={OKX_AGENT_URL}>Use on OKX.AI ↗</Pill>
          </div>

          {/* hamburger — mobile only */}
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            className="relative flex h-10 w-10 items-center justify-center md:hidden"
          >
            <span
              className={`absolute h-[1.5px] w-[18px] bg-white transition-all duration-300 ${
                open ? "rotate-45" : "-translate-y-[3.5px]"
              }`}
            />
            <span
              className={`absolute h-[1.5px] w-[18px] bg-white transition-all duration-300 ${
                open ? "-rotate-45" : "translate-y-[3.5px]"
              }`}
            />
          </button>
        </nav>
      </header>

      <MobileMenu open={open} onClose={() => setOpen(false)} links={links} />
    </>
  );
}
