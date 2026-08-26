"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "./ui/Logo";
import Pill from "./ui/Pill";
import MobileMenu from "./MobileMenu";
import { OKX_AGENT_URL } from "@/config";

const links = [
  { label: "Community feed", href: "#feed" },
  { label: "Creator digest", href: "/digest" },
  { label: "MCP service", href: "/mcp-service" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.header
        className={`sticky top-0 z-40 w-full transition-[background,border-color,backdrop-filter] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          scrolled
            ? "border-b border-white/10 bg-black/75 backdrop-blur-xl"
            : "border-b border-transparent bg-black/30 backdrop-blur-md"
        }`}
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
      >
        <nav className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 md:h-20 md:px-8">
          <Link href="/" aria-label="Mnemo home" className="flex items-center">
            <Logo size={28} withWordmark />
          </Link>

          <div className="hidden items-center gap-10 md:flex">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-[15px] font-medium text-white/60 transition-colors duration-200 hover:text-white md:text-[16px]"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Pill href={OKX_AGENT_URL}>Use on OKX.AI</Pill>
          </div>

          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            className="relative flex h-10 w-10 items-center justify-center md:hidden"
          >
            <span
              className={`absolute h-[1.5px] w-[18px] bg-white transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                open ? "rotate-45" : "-translate-y-[3.5px]"
              }`}
            />
            <span
              className={`absolute h-[1.5px] w-[18px] bg-white transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                open ? "-rotate-45" : "translate-y-[3.5px]"
              }`}
            />
          </button>
        </nav>
      </motion.header>

      <MobileMenu open={open} onClose={() => setOpen(false)} links={links} />
    </>
  );
}
