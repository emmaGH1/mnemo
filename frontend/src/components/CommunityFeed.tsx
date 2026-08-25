"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type Verdict = "safe" | "spoiler" | "lore_question" | "contradiction";

type Moderation = {
  verdict: Verdict;
  spoils_episode?: number;
  reason: string;
};

type FeedComment = {
  id: string;
  author: string;
  initials: string;
  color: string;
  text: string;
  time: string;
  likes: number;
  replies: number;
  moderation: Moderation;
};

type Feed = {
  series_id: string;
  reader_episode: number;
  comments: FeedComment[];
};

const MAX_EPISODE = 50;
const DEFAULT_EPISODE = 30;

const ease = [0.32, 0.72, 0, 1] as const;

const CHIP_BASE = "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]";
const CHIP_STYLE: Record<Exclude<Verdict, "safe">, string> = {
  spoiler: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  lore_question: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  contradiction: "border-amber-400/30 bg-amber-400/10 text-amber-200",
};

export default function CommunityFeed() {
  const [episode, setEpisode] = useState(DEFAULT_EPISODE);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const reqId = useRef(0);
  const committedEpisode = useRef(DEFAULT_EPISODE);

  const load = useCallback(async (ep: number) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/community/feed?reader_episode=${ep}`);
      if (!res.ok) throw new Error(`Feed unavailable (${res.status})`);
      const data = (await res.json()) as Feed;
      if (reqId.current !== id) return;
      if (committedEpisode.current !== data.reader_episode) {
        committedEpisode.current = data.reader_episode;
        setRevealed(new Set());
      }
      setFeed(data);
    } catch (e) {
      if (reqId.current !== id) return;
      setError(e instanceof Error ? e.message : "Feed unavailable");
    } finally {
      if (reqId.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(DEFAULT_EPISODE);
  }, [load]);

  const changeEpisode = (ep: number) => {
    setEpisode(Math.min(MAX_EPISODE, Math.max(1, ep)));
    load(ep);
  };

  const reveal = (id: string) => setRevealed((prev) => new Set(prev).add(id));

  return (
    <>
      <header className="section-immersive relative mx-auto max-w-3xl px-5 pb-10 pt-20 md:px-8 md:pt-28">
        <p className="font-mono-statement text-[11px] uppercase tracking-[0.18em] text-white/40">
          Mnemo · spoiler-aware canon memory
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white md:text-6xl">
          The Lore Olympus community feed
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/50 md:text-lg">
          A Minds agent holds the canon — 77 facts across 50 episodes, each with
          the episode that established it — and reads every comment against it.
          Comments that reveal a fact past where you are stay blurred.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-black/60 p-5 backdrop-blur-md md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                Your progress
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono-statement text-4xl text-white md:text-5xl">
                  {String(episode).padStart(2, "0")}
                </span>
                <span className="font-mono-statement text-xl text-white/30">
                  / {MAX_EPISODE}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`mr-1 flex items-center gap-1.5 font-mono text-[10px] text-white/40 ${
                  loading ? "opacity-100" : "opacity-0"
                } transition-opacity duration-200`}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />
                re-evaluating
              </span>
              {[30, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => changeEpisode(n)}
                  className={`rounded-full border px-4 py-1.5 font-mono text-[11px] transition-colors duration-200 ${
                    episode === n
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/15 text-white/50 hover:text-white"
                  }`}
                >
                  EP {n}
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={MAX_EPISODE}
            value={episode}
            onChange={(e) => changeEpisode(Number(e.target.value))}
            aria-label="Reader progress episode"
            className="mt-5 w-full accent-white"
          />
        </div>
      </header>

      <main id="feed" className="mx-auto max-w-3xl px-5 pb-28 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="font-mono-statement text-[11px] uppercase tracking-[0.18em] text-white/40">
            Feed · judged by the real Mind
          </p>
          <p className="font-mono text-[11px] text-white/35">
            {feed ? `${feed.comments.length} comments` : ""}
          </p>
        </div>

        {loading && !feed && (
          <div className="rounded-2xl border border-white/8 bg-black/40 p-10 text-center">
            <p className="font-mono text-sm text-white/40">moderating…</p>
          </div>
        )}

        {error && !feed && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-10 text-center">
            <p className="text-sm text-rose-200/80">{error}</p>
            <p className="mt-2 text-xs text-white/40">
              Start the API with <code className="font-mono">npm run dev</code>{" "}
              in the repo root.
            </p>
          </div>
        )}

        {feed && (
          <div className="space-y-4">
            {feed.comments.map((c, i) => (
              <CommentCard
                key={c.id}
                comment={c}
                episode={feed.reader_episode}
                blurred={c.moderation.verdict === "spoiler" && !revealed.has(c.id)}
                onReveal={() => reveal(c.id)}
                index={i}
              />
            ))}
            <p className="pt-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/25">
              Seeded demo comments · verdicts cached from the real Mind at episode 1
            </p>
          </div>
        )}
      </main>
    </>
  );
}

function CommentCard({
  comment: c,
  episode,
  blurred,
  onReveal,
  index,
}: {
  comment: FeedComment;
  episode: number;
  blurred: boolean;
  onReveal: () => void;
  index: number;
}) {
  const v = c.moderation.verdict;
  const chip =
    v === "safe" || v === "spoiler"
      ? null
      : { label: v === "lore_question" ? "Answered from canon" : "Disputed" };

  return (
    <motion.article
      className="rounded-2xl border border-white/8 bg-black/50 p-4 md:p-5"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.5), ease }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono-statement text-[11px] uppercase text-black"
          style={{ backgroundColor: c.color }}
        >
          {c.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white/90">
            {c.author}
          </p>
          <p className="text-xs text-white/40">
            {c.time} · ♥ {c.likes} · {c.replies} replies
          </p>
        </div>
        {chip && (
          <span className={`${CHIP_BASE} ${CHIP_STYLE[v as Exclude<Verdict, "safe" | "spoiler">]}`}>
            {chip.label}
          </span>
        )}
      </div>

      {blurred ? (
        <BlurredText comment={c} episode={episode} onReveal={onReveal} />
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-white/80">{c.text}</p>
      )}

      {v !== "safe" && !blurred && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <span className={`${CHIP_BASE} ${CHIP_STYLE[v as Exclude<Verdict, "safe">]}`}>
            {v === "spoiler"
              ? `Spoils Episode ${c.moderation.spoils_episode}`
              : v === "lore_question"
                ? "Answered from canon"
                : "Disputed"}
          </span>
          <p
            className="w-full text-xs leading-relaxed text-white/35 md:flex-1"
            title={c.moderation.reason}
          >
            {c.moderation.reason}
          </p>
        </div>
      )}
    </motion.article>
  );
}

function BlurredText({
  comment,
  episode,
  onReveal,
}: {
  comment: FeedComment;
  episode: number;
  onReveal: () => void;
}) {
  return (
    <div className="relative mt-3 overflow-hidden rounded-xl border border-rose-400/10 bg-white/[0.03]">
      <p className="select-none px-4 py-3 text-sm leading-relaxed text-white/70 blur-[5px]">
        {comment.text}
      </p>
      <button
        onClick={onReveal}
        className="absolute inset-0 flex w-full flex-col items-center justify-center gap-2"
        aria-label="Reveal spoiler comment"
      >
        <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-200">
          Spoils Episode {comment.moderation.spoils_episode} · you're on{" "}
          {episode}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">
          Tap to reveal
        </span>
      </button>
    </div>
  );
}
