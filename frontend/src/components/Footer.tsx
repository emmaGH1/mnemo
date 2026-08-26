"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "./ui/Logo";
import Pill from "./ui/Pill";
import Reveal from "./ui/Reveal";
import { OKX_AGENT_URL } from "@/config";

const product: [string, string][] = [
  ["Community feed", "#feed"],
  ["Creator digest", "/digest"],
  ["MCP service", "/mcp-service"],
];

const connect: [string, string][] = [
  ["Twitter", "https://x.com/mnemohq"],
  ["GitHub", "https://github.com/mnemo"],
  ["Gmail", "mailto:hi@mnemo.app"],
  ["OKX listing", OKX_AGENT_URL],
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
            Ready when your agent is
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            Catch the break before the readers do.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/45 md:text-lg">
            One prompt. One payment. A flag list your agent can ship.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Pill href={OKX_AGENT_URL} className="justify-center">
              Use on OKX.AI
            </Pill>
            <Pill href="#use" variant="outline" className="justify-center">
              Copy the prompt
            </Pill>
          </div>
        </Reveal>

        {/* link grid */}
        <div className="mt-20 grid gap-12 border-t border-white/8 pt-14 sm:grid-cols-2 md:grid-cols-12 md:gap-8">
          <Reveal className="md:col-span-5" delay={0.05}>
            <Link href="/" aria-label="Mnemo home" className="inline-flex">
              <Logo size={32} withWordmark />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/40">
              Continuity checks for serialized webtoon art — settled on-chain
              via x402.
            </p>
          </Reveal>

          <Reveal className="md:col-span-3" delay={0.1}>
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

          <Reveal className="md:col-span-4" delay={0.15}>
            <p className="font-mono-statement text-[11px] uppercase tracking-[0.16em] text-white/35">
              Connect
            </p>
            <ul className="mt-4 space-y-3">
              {connect.map(([label, href], i) => {
                const external =
                  href.startsWith("http") || href.startsWith("mailto:");
                return (
                  <motion.li
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.35,
                      delay: 0.15 + i * 0.05,
                      ease,
                    }}
                  >
                    <Link
                      href={href}
                      {...(external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="text-[15px] text-white/55 transition-colors duration-200 hover:text-white"
                    >
                      {label}
                      {href.startsWith("http") ? (
                        <span className="ml-1.5 text-white/25">↗</span>
                      ) : null}
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          </Reveal>
        </div>

        {/* bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-8 sm:flex-row">
          <p className="font-mono text-[11px] tracking-wide text-white/30">
            © {new Date().getFullYear()} mnemo
          </p>
          <p className="font-mono text-[11px] tracking-wide text-white/25">
            Agent 6211 · x402 · 0.1 USDT
          </p>
        </div>
      </div>
    </footer>
  );
}
