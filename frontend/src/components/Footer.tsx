"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "./ui/Logo";
import Reveal from "./ui/Reveal";

const product: [string, string][] = [
  ["Reader feed", "/"],
  ["Creator digest", "/digest"],
];

const ease = [0.32, 0.72, 0, 1] as const;

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/8">
      {/* ambient field */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(255,255,255,0.05), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <div className="relative mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        {/* closing CTA band */}
        <Reveal className="text-center">
          <p className="font-mono-statement text-[12px] uppercase tracking-[0.18em] text-white/40">
            Canon remembers. Readers choose.
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            Let the conversation move at every reader&rsquo;s pace.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/45 md:text-lg">
            Mnemo maps community comments to established canon, then protects
            the moments a reader has not reached yet.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/"
              className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-white/90"
            >
              Try reader progress
            </Link>
            <Link
              href="/digest"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white"
            >
              View creator digest
            </Link>
          </div>
        </Reveal>

        {/* link grid */}
        <div className="mt-20 grid gap-12 border-t border-white/8 pt-14 sm:grid-cols-2 md:grid-cols-12 md:gap-8">
          <Reveal className="md:col-span-7" delay={0.05}>
            <Link href="/" aria-label="Mnemo home" className="inline-flex">
              <Logo size={32} withWordmark />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/40">
              Spoiler-aware canon intelligence for serialized-fiction
              communities.
            </p>
          </Reveal>

          <Reveal className="md:col-span-5" delay={0.1}>
            <p className="font-mono-statement text-[11px] uppercase tracking-[0.16em] text-white/35">
              Product
            </p>
            <ul className="mt-4 space-y-3">
              {product.map(([label, href], i) => (
                <motion.li
                  key={label}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: 0.12 + i * 0.05, ease }}
                >
                  <Link
                    href={href}
                    className="text-[15px] text-white/55 transition-colors duration-200 hover:text-white"
                  >
                    {label}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </Reveal>

        </div>

        {/* bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-8 sm:flex-row">
          <p className="font-mono text-[11px] tracking-wide text-white/30">
            © {new Date().getFullYear()} mnemo
          </p>
          <p className="font-mono text-[11px] tracking-wide text-white/25">
            Seeded Lore Olympus demo · 50 episodes
          </p>
        </div>
      </div>
    </footer>
  );
}
