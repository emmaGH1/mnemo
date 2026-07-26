"use client";

import { motion } from "framer-motion";
import Pill from "./ui/Pill";
import Reveal from "./ui/Reveal";
import { OKX_AGENT_URL } from "@/config";

const included = [
  {
    label: "Continuity check",
    detail: "One page scored against canon",
  },
  {
    label: "Inline flags",
    detail: "Breaks tied to the panel they came from",
  },
  {
    label: "x402 settle",
    detail: "Paid from the agent wallet — no account",
  },
  {
    label: "No API key",
    detail: "No sign-up, no dashboard, no plan",
  },
];

const ease = [0.32, 0.72, 0, 1] as const;

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="section-immersive relative scroll-mt-24 overflow-hidden px-4 py-24 sm:px-5 md:px-6 md:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 42%, rgba(255,255,255,0.06), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl">
        <Reveal className="text-center">
          <p className="font-mono-statement text-[13px] uppercase tracking-wider text-white/50">
            Pricing
          </p>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            One price. Every check.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-white/55">
            Pay per page, not per seat. Your agent settles automatically —
            you never open a wallet.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <motion.div
            className="relative mx-auto mt-14 max-w-lg"
            whileHover={{ y: -3 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
          >
            <div
              aria-hidden
              className="absolute -inset-px rounded-[1.35rem] bg-gradient-to-b from-white/25 via-white/8 to-transparent opacity-90"
            />

            <div className="relative overflow-hidden rounded-[1.25rem] border border-white/12 bg-black/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between border-b border-white/8 px-6 py-4 md:px-8">
                <span className="font-mono-statement text-[11px] uppercase tracking-wider text-white/45">
                  Continuity Check
                </span>
                <span className="rounded-full border border-white/12 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/55">
                  per call
                </span>
              </div>

              <div className="px-6 py-10 text-center md:px-8 md:py-12">
                <motion.p
                  className="font-oi text-[2.75rem] leading-none tracking-tight text-white md:text-6xl"
                  initial={{ opacity: 0, scale: 0.92 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, ease }}
                >
                  0.1 USDT
                </motion.p>
                <p className="mt-3 font-mono text-sm text-white/40">
                  settled via x402 · Agent 6211
                </p>
              </div>

              <ul className="border-t border-white/8 px-6 py-6 md:px-8">
                {included.map((item, i) => (
                  <motion.li
                    key={item.label}
                    className={`flex items-start gap-3 py-3 ${
                      i < included.length - 1 ? "border-b border-white/6" : ""
                    }`}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.15 + i * 0.07, ease }}
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/20"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-white/90">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-sm text-white/40">
                        {item.detail}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ul>

              <div className="border-t border-white/8 px-6 py-6 md:px-8">
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-white/40">
                    No account. No API key. No plan.
                  </p>
                  <Pill href={OKX_AGENT_URL} className="justify-center">
                    Use on OKX.AI
                  </Pill>
                </div>
              </div>
            </div>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}
