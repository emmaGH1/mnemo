"use client";

import { motion } from "framer-motion";
import Pill from "./ui/Pill";
import Reveal from "./ui/Reveal";

// Marker positions map to before-and-after-reference.png (Ep4 left · Ep50 right).
const flags = [
  { x: "22%", y: "18%", label: "hair", side: "before" as const },
  { x: "22%", y: "38%", label: "eyes", side: "before" as const },
  { x: "78%", y: "18%", label: "hair", side: "after" as const },
  { x: "78%", y: "38%", label: "eyes", side: "after" as const },
];

const breaks = [
  { from: "auburn", to: "silver", trait: "Hair color" },
  { from: "green", to: "red", trait: "Eye color" },
];

const ease = [0.32, 0.72, 0, 1] as const;

export default function Showcase() {
  return (
    <section
      id="showcase"
      className="section-immersive relative scroll-mt-20 px-4 py-24 sm:px-5 md:px-6 md:py-40"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_20%_40%,rgba(255,255,255,0.035),transparent_65%)]"
      />
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 md:grid-cols-2 md:gap-16">
        <Reveal>
          <div className="relative mx-auto w-full max-w-[640px]">
            {/* double-bezel frame */}
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="relative overflow-hidden rounded-[1.05rem] border border-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/before-and-after-reference.png"
                  alt="Same character in Episode 4 versus Episode 50 — hair auburn to silver, eyes green to red"
                  className="w-full"
                />

                {/* episode chips overlaid on the split */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 pb-3 pt-10 md:px-4 md:pb-4">
                  <span className="rounded-full border border-white/15 bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/80 backdrop-blur-sm md:text-[11px]">
                    Episode 4
                  </span>
                  <span className="rounded-full border border-red-400/35 bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-red-300/90 backdrop-blur-sm md:text-[11px]">
                    Episode 50
                  </span>
                </div>
              </div>
            </div>

            {/* continuity markers — green on canon, red on the break */}
            {flags.map((f, i) => {
              const isBreak = f.side === "after";
              return (
                <motion.div
                  key={`${f.side}-${f.label}`}
                  className="absolute"
                  style={{ left: f.x, top: f.y }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.45,
                    delay: 0.45 + i * 0.1,
                    ease,
                  }}
                >
                  <motion.span
                    className={`flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 md:h-6 md:w-6 ${
                      isBreak
                        ? "border-[#ef4444] shadow-[0_0_16px_rgba(239,68,68,0.55)]"
                        : "border-emerald-400/80 shadow-[0_0_12px_rgba(52,211,153,0.35)]"
                    }`}
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{
                      duration: 2.4,
                      repeat: Infinity,
                      delay: i * 0.3,
                      ease: "easeInOut",
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white/95 md:h-2 md:w-2" />
                  </motion.span>
                  <span
                    className={`absolute left-0 top-3 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[9px] backdrop-blur-sm md:text-[10px] ${
                      isBreak
                        ? "border-[#ef4444]/40 bg-black/85 text-white/80"
                        : "border-emerald-400/30 bg-black/85 text-white/75"
                    }`}
                  >
                    {f.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </Reveal>

        <Reveal className="text-center md:text-left" delay={0.08}>
          <p className="font-mono-statement text-[13px] uppercase tracking-wider text-white/50">
            See it work
          </p>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Continuity, caught.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-white/55 md:mx-0 md:text-xl">
            Same face across forty-six episodes. Two traits drifted — hair and
            eyes — flagged before readers notice.
          </p>

          {/* episode range callout */}
          <div className="mx-auto mt-7 flex max-w-sm items-center justify-center gap-3 md:mx-0 md:justify-start">
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-white/60">
              ep004
            </span>
            <span className="h-px w-8 bg-gradient-to-r from-white/30 to-red-400/50" />
            <span className="rounded-md border border-red-400/25 bg-red-500/10 px-2.5 py-1 font-mono text-[11px] text-red-300/90">
              ep050
            </span>
          </div>

          <ul className="mx-auto mt-8 inline-block w-full max-w-sm space-y-2.5 text-left font-mono text-sm md:mx-0">
            {breaks.map((b, i) => (
              <motion.li
                key={b.trait}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-white/70"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.35 + i * 0.1, ease }}
              >
                <span className="text-red-400/90">✗</span>
                <span className="text-white/45">{b.trait}:</span>
                <span className="text-white/80">{b.from}</span>
                <span className="text-white/30">→</span>
                <span className="text-red-300/90">{b.to}</span>
              </motion.li>
            ))}
          </ul>

          <div className="mt-10">
            <Pill href="#watch" variant="outline">
              See it scan a page
            </Pill>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
