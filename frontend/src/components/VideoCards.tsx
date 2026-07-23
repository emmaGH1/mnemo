"use client";

import { useEffect, useRef } from "react";
import Reveal from "./ui/Reveal";

// Swap-in path: drop .mp4 (+ poster.jpg) into frontend/public/videos/, flip ready to true.
const videos = [
  {
    id: "01",
    label: "Watch the agent",
    bar: "watch",
    videoSrc: "/videos/watch.mp4",
    posterSrc: "/videos/watch-poster.jpg",
    duration: "0:42",
    ready: false,
  },
  {
    id: "02",
    label: "See the report",
    bar: "check",
    title: "Catch every break",
    description:
      "Run a single page through the checker. Continuity breaks are flagged inline with the panel they came from.",
    videoSrc: "/videos/check.mp4",
    posterSrc: "/videos/check-poster.jpg",
    duration: "0:38",
    ready: false,
    align: "right" as const,
  },
  {
    id: "03",
    label: "Tell your agent",
    bar: "agent",
    title: "Tell your agent",
    description:
      "Paste the prompt. Your agent pays 0.1 USDT via x402, calls Agent 6211, and ships you a flag list. No account, no API key.",
    videoSrc: "/videos/agent.mp4",
    posterSrc: "/videos/agent-poster.jpg",
    duration: "0:48",
    ready: false,
    align: "left" as const,
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
      <p className="mt-2 text-white/70">
        ⟶ routing to okx.ai/agents/6211
      </p>
      <p className="text-white/70">
        ⟶ x402 settle: 0.1 USDT ✓
      </p>
      <p className="mt-2 text-white/85">
        2 flags · eye_color · hair_color
      </p>
    </div>
  );
}

function VideoPanel({
  v,
  className = "",
}: {
  v: (typeof videos)[number];
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black transition-colors duration-150 hover:border-white/15 ${className}`}
    >
      {v.ready ? (
        <video
          src={v.videoSrc}
          poster={v.posterSrc}
          muted
          autoPlay
          loop
          playsInline
          className="h-full w-full object-cover"
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
    </div>
  );
}

export default function VideoCards() {
  const ref = useRef<HTMLDivElement>(null);

  // Play videos at ≥40% visibility, pause below. No-op until real videos exist.
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
    <section id="watch" className="scroll-mt-20 px-5 pb-20 pt-12 md:px-6">
      <div ref={ref} className="mx-auto flex max-w-[1100px] flex-col gap-24">
        <Reveal className="text-center md:text-left">
          <p className="font-mono-statement text-[13px] uppercase tracking-wider text-white/50">
            In action
          </p>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            See the agent work.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/55 md:text-xl">
            Real terminal sessions, real continuity reports, real canon
            builds.
          </p>
        </Reveal>
        {videos.map((v) => (
          <Reveal key={v.id}>
            {v.title ? (
              <div className="text-center md:text-left">
                <p className="font-mono-statement text-[13px] uppercase tracking-wider text-white/50">
                  {v.label}
                </p>
                <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
                  {v.title}
                </h3>
                <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-white/50 md:mx-0">
                  {v.description}
                </p>
              </div>
            ) : null}
            <VideoPanel
              v={v}
              className={
                v.title
                  ? `mt-8 ${
                      v.align === "right"
                        ? "md:ml-auto md:max-w-[70%]"
                        : "md:mr-auto md:max-w-[70%]"
                    }`
                  : ""
              }
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
