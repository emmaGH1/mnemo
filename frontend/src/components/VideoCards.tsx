"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Reveal from "./ui/Reveal";

type VideoEntry = {
  id: string;
  label: string;
  bar: string;
  videoSrc: string;
  posterSrc: string;
  duration: string;
  ready: boolean;
  title?: string;
  description?: string;
  align?: "left" | "right";
  /** Intrinsic pixel size of the source file — card matches this aspect exactly. */
  width: number;
  height: number;
  /** Desktop-only max width (e.g. "70%"). Mobile always full width like segment 1. */
  maxWidthMd?: string;
};

const videos: VideoEntry[] = [
  {
    id: "01",
    label: "Watch the agent",
    bar: "watch",
    videoSrc: "/videos/watch.mp4",
    posterSrc: "/videos/watch_poster.png",
    duration: "0:42",
    ready: true,
    width: 1920,
    height: 1080,
  },
  {
    id: "02",
    label: "See the report",
    bar: "check",
    title: "Catch every break",
    description:
      "Run a single page through the checker. Continuity breaks are flagged inline with the panel they came from.",
    videoSrc: "/videos/check.mp4",
    posterSrc: "/videos/check_poster.jpg",
    duration: "0:38",
    ready: true,
    align: "right",
    width: 960,
    height: 720,
    maxWidthMd: "70%",
  },
  {
    id: "03",
    label: "Tell your agent",
    bar: "agent",
    title: "Tell your agent",
    description:
      "Paste the prompt. Your agent pays 0.1 USDT via x402, calls Agent 6211, and ships you a flag list. No account, no API key.",
    videoSrc: "/videos/agent.mp4",
    posterSrc: "/videos/agent_poster.jpg",
    duration: "0:48",
    ready: true,
    align: "left",
    width: 1280,
    height: 720,
    maxWidthMd: "70%",
  },
];

function RecordingChip() {
  return (
    <span className="absolute right-4 top-4 font-mono text-[10px] tracking-wide text-white/30">
      [ RECORDING ]
    </span>
  );
}

function MockContent({ id }: { id: string }) {
  if (id === "01") {
    return (
      <div className="absolute inset-0 flex flex-col p-5 pt-12">
        <div className="font-mono text-xs leading-6 text-white/55">
          <p>
            <span className="text-white/30">$</span> mnemo watch --series
            lore-olympus
          </p>
          <p>
            <span className="text-white/70">✓</span> ep003_p01.png — checked
          </p>
          <p>
            <span className="text-white/70">✓</span> ep003_p05.png — checked
          </p>
          <p>
            <span className="inline-block animate-spin text-white/70 [animation-duration:2s]">
              ◐
            </span>{" "}
            ep003_p08.png — checking…
          </p>
        </div>
      </div>
    );
  }
  if (id === "02") {
    return (
      <div className="absolute inset-0 flex items-center gap-6 p-5 pt-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sample-page.png"
          alt="ep003_p08.png"
          className="h-2/3 w-auto rounded-lg border border-white/10"
        />
        <div className="font-mono text-xs leading-6 text-white/55">
          <p>
            <span className="text-red-400/80">✗</span> hair_color: dark →
            blonde
          </p>
          <p>
            <span className="text-red-400/80">✗</span> eye_color: yellow →
            green
          </p>
          <p>
            <span className="text-red-400/80">✗</span> freckles: missing
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col p-5 pt-12 font-mono text-[11px] leading-6 text-white/55">
      <p>
        <span className="text-white/30">you</span> › use Agent 6211 to check
        ep003_p30.jpg
      </p>
      <p className="mt-2 text-white/70">⟶ routing to okx.ai/agents/6211</p>
      <p className="text-white/70">⟶ x402 settle: 0.1 USDT ✓</p>
      <p className="mt-2 text-white/85">2 flags · eye_color · hair_color</p>
    </div>
  );
}

function VideoPanel({ v }: { v: VideoEntry }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dims, setDims] = useState({ w: v.width, h: v.height });

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const apply = () => {
      if (el.videoWidth > 0 && el.videoHeight > 0) {
        setDims({ w: el.videoWidth, h: el.videoHeight });
      }
    };
    el.addEventListener("loadedmetadata", apply);
    apply();
    return () => el.removeEventListener("loadedmetadata", apply);
  }, [v.videoSrc]);

  // Full width on mobile (like segment 1). Narrow + align only from md up.
  const alignClass =
    v.align === "right"
      ? "md:ml-auto"
      : v.align === "left"
        ? "md:mr-auto"
        : "";
  // Tailwind needs static class strings; map known max widths explicitly.
  const maxWClass =
    v.maxWidthMd === "70%"
      ? "md:max-w-[70%]"
      : v.maxWidthMd === "85%"
        ? "md:max-w-[85%]"
        : "";

  return (
    <motion.div
      className={`relative w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-colors duration-300 hover:border-white/20 sm:rounded-2xl ${alignClass} ${maxWClass} ${
        v.title ? "mt-6 sm:mt-8" : ""
      }`}
      style={{ aspectRatio: `${dims.w} / ${dims.h}` }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      {v.ready ? (
        <video
          ref={videoRef}
          src={v.videoSrc}
          poster={v.posterSrc}
          width={dims.w}
          height={dims.h}
          muted
          autoPlay
          loop
          playsInline
          className="block h-full w-full object-contain"
        />
      ) : (
        <>
          <span className="absolute left-4 top-4 z-10 text-xs text-white/40">
            {v.title ? (
              <span className="font-mono">mnemo · {v.bar}</span>
            ) : (
              <span className="font-mono-statement text-[11px] uppercase tracking-wider text-white/50">
                {v.label}
              </span>
            )}
          </span>
          <RecordingChip />
          <MockContent id={v.id} />
        </>
      )}
    </motion.div>
  );
}

export default function VideoCards() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vids = ref.current?.querySelectorAll("video") ?? [];
    if (!vids.length) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          if (e.intersectionRatio >= 0.4) v.play().catch(() => {});
          else v.pause();
        }),
      { threshold: [0, 0.4] }
    );
    vids.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="watch"
      className="section-immersive relative scroll-mt-20 px-4 pb-24 pt-16 sm:px-5 md:px-6 md:pb-32 md:pt-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(255,255,255,0.04),transparent_60%)]"
      />
      <div ref={ref} className="relative mx-auto flex max-w-[1100px] flex-col gap-16 sm:gap-20 md:gap-24">
        <Reveal className="text-center md:text-left">
          <p className="font-mono-statement text-[13px] uppercase tracking-wider text-white/50">
            In action
          </p>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            See the agent work.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/55 md:mx-0 md:text-xl">
            Real terminal sessions, real continuity reports, real canon
            builds.
          </p>
        </Reveal>
        {videos.map((v, i) => (
          <Reveal key={v.id} delay={i * 0.06}>
            {v.title ? (
              <div className="text-center md:text-left">
                <p className="font-mono-statement text-[13px] uppercase tracking-wider text-white/50">
                  {v.label}
                </p>
                <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
                  {v.title}
                </h3>
                <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-white/50 sm:text-lg md:mx-0">
                  {v.description}
                </p>
              </div>
            ) : null}
            <VideoPanel v={v} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
