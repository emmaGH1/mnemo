"use client";

import { motion, useReducedMotion } from "framer-motion";
import Pill from "./ui/Pill";
import { OKX_AGENT_URL } from "@/config";

const ease = [0.32, 0.72, 0, 1] as const;

const liveLines = [
  { t: "ep003_p01", ok: true, msg: "0 breaks · 1 canon addition" },
  { t: "ep003_p05", ok: false, msg: "2 breaks · hair_color · eye_color" },
  { t: "ep003_p08", ok: true, msg: "0 breaks · scanning…" },
];

const floatOrbs = [
  { x: "12%", y: "22%", size: 280, delay: 0 },
  { x: "78%", y: "58%", size: 220, delay: 1.2 },
  { x: "55%", y: "18%", size: 160, delay: 0.6 },
];

export default function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative flex min-h-[88dvh] items-center justify-center overflow-hidden bg-black px-5 pb-28 pt-28 md:min-h-[820px] md:px-6 md:pt-36">
      <div aria-hidden className="hero-grid absolute inset-0" />
      <div aria-hidden className="hero-mesh absolute inset-0" />
      <div aria-hidden className="hero-spotlight absolute inset-0" />

      {!reduce &&
        floatOrbs.map((o, i) => (
          <motion.div
            key={i}
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              left: o.x,
              top: o.y,
              width: o.size,
              height: o.size,
              marginLeft: -o.size / 2,
              marginTop: -o.size / 2,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)",
            }}
            animate={{
              y: [0, -18, 0],
              scale: [1, 1.08, 1],
              opacity: [0.45, 0.75, 0.45],
            }}
            transition={{
              duration: 8 + i * 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: o.delay,
            }}
          />
        ))}

      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          initial={{ top: "15%", opacity: 0 }}
          animate={{ top: ["15%", "78%"], opacity: [0, 0.7, 0] }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
            repeatDelay: 1.5,
          }}
        />
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <motion.h1
          className="mx-auto max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-white md:text-8xl"
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.05, ease }}
        >
          Continuity for serialized webtoon art.
        </motion.h1>

        <motion.p
          className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-white/55 md:text-xl"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.14, ease }}
        >
          An agent that watches every page you ship, flags what doesn&rsquo;t
          match, and remembers so you never have to.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-center"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.24, ease }}
        >
          <Pill
            href={OKX_AGENT_URL}
            className="w-full justify-center sm:w-auto"
          >
            Use on OKX.AI
          </Pill>
          <Pill
            href="#use"
            variant="outline"
            className="w-full justify-center sm:w-auto"
          >
            See how it works
          </Pill>
        </motion.div>

        <motion.div
          className="mt-14 w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.36, ease }}
        >
          <div className="rounded-[0.9rem] border border-white/[0.06] bg-white/[0.02] px-4 py-3 md:px-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                mnemo · watch
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/40">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />
                stream
              </span>
            </div>
            <ul className="space-y-2 font-mono text-[12px] leading-relaxed md:text-[13px]">
              {liveLines.map((line, i) => (
                <motion.li
                  key={line.t}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left text-white/55"
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.45,
                    delay: 0.5 + i * 0.18,
                    ease,
                  }}
                >
                  <span
                    className={
                      line.ok ? "text-emerald-400/90" : "text-red-400/90"
                    }
                  >
                    {line.ok ? "✓" : "✗"}
                  </span>
                  <span className="text-white/75">{line.t}</span>
                  <span className="text-white/30">—</span>
                  <span>{line.msg}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/80 to-transparent"
      />
    </section>
  );
}
