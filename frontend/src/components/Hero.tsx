"use client";

import { motion } from "framer-motion";
import Pill from "./ui/Pill";
import { heroUseVideo, OKX_AGENT_URL } from "@/config";

export default function Hero() {
  return (
    <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-5 pb-20 pt-28 md:min-h-[720px] md:px-6">
      {/* background — Ken Burns still, or video when one lands */}
      <div className="absolute inset-0">
        {heroUseVideo ? (
          <video
            src="/videos/hero.mp4"
            poster="/sample-page.png"
            muted
            autoPlay
            loop
            playsInline
            className="h-full w-full object-cover opacity-50 md:opacity-100"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/sample-page.png"
            alt=""
            aria-hidden
            className="kenburns h-full w-full object-cover opacity-50 md:opacity-100"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 mx-auto max-w-3xl text-center"
      >
        <p className="mb-6 text-xs uppercase tracking-wider text-white/60">
          Agent 6211 on OKX.AI
        </p>
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-white md:text-7xl">
          Continuity for serialized webtoon art.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-white/55 md:text-lg">
          An agent that watches every page you ship, flags what doesn&rsquo;t
          match, and remembers so you never have to.
        </p>
        <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-center">
          <Pill
            href={OKX_AGENT_URL}
            className="w-full justify-center sm:w-auto"
          >
            Use on OKX.AI ↗
          </Pill>
          <Pill
            href="#use"
            variant="outline"
            className="w-full justify-center sm:w-auto"
          >
            See how it works
          </Pill>
        </div>
      </motion.div>
    </section>
  );
}
