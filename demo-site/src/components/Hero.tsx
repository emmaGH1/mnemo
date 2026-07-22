"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const links = [
  { label: "Checker", href: "#checker" },
  { label: "Watcher", href: "#watcher" },
  { label: "How it works", href: "#how" },
];

export default function Hero() {
  const [open, setOpen] = useState(false);

  return (
    <section className="relative min-h-[100dvh] flex flex-col items-center justify-center px-5 overflow-hidden">
      {/* ambient glows — the comic's own light */}
      <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[min(90vw,700px)] h-[700px] rounded-full bg-[var(--lamp-dim)] blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[5%] w-[400px] h-[400px] rounded-full bg-[var(--perse)] blur-[110px] pointer-events-none" />
      <div className="absolute top-[30%] right-[0%] w-[400px] h-[400px] rounded-full bg-[var(--hades)] blur-[110px] pointer-events-none" />

      {/* floating pill nav */}
      <motion.nav
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
        className="fixed top-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 glass rounded-full pl-5 pr-2 py-2"
        style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
      >
        <a href="#" className="text-base font-bold tracking-tight mr-3 display">
          Mnemo<span className="text-amber-500">.</span>
        </a>
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-4 py-1.5 rounded-full text-[13px] text-white/55 hover:text-white hover:bg-white/5"
            >
              {l.label}
            </a>
          ))}
        </div>
        {/* hamburger morph */}
        <button
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          className="md:hidden relative w-9 h-9 rounded-full bg-white/5 flex flex-col items-center justify-center gap-[5px]"
        >
          <span className={`block w-4 h-[1.5px] bg-white transition-all duration-500 ${open ? "rotate-45 translate-y-[3.25px]" : ""}`} />
          <span className={`block w-4 h-[1.5px] bg-white transition-all duration-500 ${open ? "-rotate-45 -translate-y-[3.25px]" : ""}`} />
        </button>
      </motion.nav>

      {/* mobile menu — full-screen glass veil */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-30 bg-black/80 md:hidden flex flex-col items-center justify-center gap-8"
            style={{ backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}
            onClick={() => setOpen(false)}
          >
            {links.map((l, i) => (
              <motion.a
                key={l.href}
                href={l.href}
                initial={{ y: 32, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                className="display text-3xl font-semibold text-white/80 hover:text-amber-400"
              >
                {l.label}
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* floating page-artifacts — desktop only */}
      <motion.div
        className="absolute top-[16%] left-[7%] w-40 h-56 hidden lg:block"
        animate={{ y: [0, -14, 0], rotate: [-4, -2, -4] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="bezel w-full h-full">
          <div className="core w-full h-full p-3 flex flex-col gap-2">
            <div className="flex-1 rounded-xl bg-gradient-to-br from-pink-400/25 to-blue-400/25" />
            <div className="h-1.5 w-3/4 rounded-full bg-white/10" />
            <div className="h-1.5 w-1/2 rounded-full bg-white/10" />
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-[18%] right-[8%] w-44 h-60 hidden lg:block"
        animate={{ y: [0, 12, 0], rotate: [3, 5, 3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <div className="bezel w-full h-full">
          <div className="core w-full h-full p-3 flex flex-col gap-2">
            <div className="flex-1 rounded-xl bg-gradient-to-br from-amber-400/25 to-red-400/25" />
            <div className="flex items-center gap-1.5">
              <span className="h-4 px-1.5 rounded-md bg-red-500/30 border border-red-500/40 text-[8px] flex items-center text-red-300 font-bold tracking-wider">FLAG</span>
              <div className="h-1.5 flex-1 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* statement */}
      <motion.div
        className="relative z-10 text-center max-w-4xl pt-16"
        initial={{ opacity: 0, y: 36, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="eyebrow mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 breathe" />
          OKX.AI ASP · x402 · MCP
        </div>

        <h1 className="display text-[13vw] sm:text-6xl md:text-7xl lg:text-[5.25rem] font-semibold leading-[1.02] mb-7">
          Mnemo remembers.
          <br />
          <span className="gradient-text">You create.</span>
        </h1>

        <p className="text-base md:text-lg text-white/50 max-w-xl mx-auto mb-11 leading-relaxed">
          The second brain for webtoon artists. Mnemo silently watches every page
          for continuity errors — so you never break your own story.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="#checker"
            className="group inline-flex items-center gap-2.5 pl-7 pr-2 py-2 rounded-full bg-amber-500 text-black font-semibold active:scale-[0.98]"
          >
            Try the checker
            <span className="w-8 h-8 rounded-full bg-black/15 flex items-center justify-center transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-[1px] group-hover:scale-105">
              ↗
            </span>
          </a>
          <a
            href="#watcher"
            className="group inline-flex items-center gap-2.5 pl-7 pr-2 py-2 rounded-full glass font-semibold active:scale-[0.98]"
          >
            See what it caught
            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-[1px] group-hover:scale-105">
              →
            </span>
          </a>
        </div>
      </motion.div>

      {/* scroll hint */}
      <div className="absolute bottom-7 text-white/25 text-[10px] tracking-[0.3em] uppercase breathe">
        scroll
      </div>
    </section>
  );
}
