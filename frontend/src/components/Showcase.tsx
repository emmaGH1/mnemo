"use client";

import { motion } from "framer-motion";
import Pill from "./ui/Pill";
import Reveal from "./ui/Reveal";

const flags = [
  { x: "18%", y: "12%", label: "hair color" },
  { x: "52%", y: "45%", label: "eye color" },
  { x: "38%", y: "62%", label: "mark" },
];

const errors = [
  "Hair color: dark → blonde",
  "Eye color: yellow → green",
  "Distinguishing mark: freckles missing",
];

export default function Showcase() {
  return (
    <section id="showcase" className="px-5 py-24 md:px-6 md:py-40">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 md:grid-cols-2">
        <Reveal>
          <div className="relative mx-auto w-full max-w-[640px]">
            <div className="overflow-hidden rounded-2xl border border-white/8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sample-page.png"
                alt="A webtoon page from Lore Olympus with Mnemo's continuity flags"
                className="w-full"
              />
            </div>
            {flags.map((f, i) => (
              <motion.div
                key={f.label}
                className="absolute"
                style={{ left: f.x, top: f.y }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
              >
                <span className="flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                  <span className="h-2 w-2 rounded-full bg-white/95" />
                </span>
                <span className="absolute left-0 top-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#ef4444]/40 bg-black/80 px-2 py-0.5 font-mono text-[10px] text-white/80">
                  {f.label}
                </span>
              </motion.div>
            ))}
          </div>
        </Reveal>

        <Reveal className="text-center md:text-left">
          <p className="text-xs uppercase tracking-wider text-white/50">
            01 / See it work
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Continuity, caught.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/55 md:mx-0">
            Mnemo scanned a page from Lore Olympus. Three breaks — caught
            before publish.
          </p>
          <ul className="mx-auto mt-8 inline-block space-y-2 text-left font-mono text-sm text-white/70 md:mx-0">
            {errors.map((e) => (
              <li key={e} className="flex gap-3">
                <span className="text-red-400/80">✗</span>
                {e}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Pill href="#api" variant="outline">
              See it scan a page
            </Pill>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
