"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type DigestItem = {
  comment_id: string;
  author: string;
  text: string;
  spoils_episode?: number;
};

type DigestData = {
  series_id: string;
  generated_at: string;
  source: "cached Mind verdicts";
  counts: {
    safe: number;
    spoiler: number;
    lore_question: number;
    contradiction: number;
    total: number;
  };
  worst_spoiler: DigestItem | null;
  spoilers: DigestItem[];
  questions: DigestItem[];
  contradictions: DigestItem[];
};

const ease = [0.32, 0.72, 0, 1] as const;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Digest() {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let disposed = false;
    fetch("/api/digest")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Digest unavailable (${res.status})`);
        const data = (await res.json()) as DigestData;
        if (!disposed) setDigest(data);
      })
      .catch((e) => !disposed && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !disposed && setLoading(false));

    const es = new EventSource("/api/digest/stream");
    es.addEventListener("digest", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as DigestData;
        setDigest(data);
        setLive(true);
      } catch {
        // ignore malformed event
      }
    });
    es.onerror = () => setLive(false);
    return () => {
      disposed = true;
      es.close();
    };
  }, []);

  const c = digest?.counts;

  return (
    <>
      <header className="section-immersive relative mx-auto max-w-4xl px-5 pb-10 pt-20 md:px-8 md:pt-28">
        <p className="font-mono-statement text-[11px] uppercase tracking-[0.18em] text-white/40">
          Mnemo · autonomy
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white md:text-6xl">
          Overnight digest
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/50 md:text-lg">
          While you slept, Mnemo read every comment against the canon memory and
          graded it for your readers — spoilers relative to their progress, lore
          questions it can answer, and claims that contradict established canon.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-center gap-2 font-mono text-[11px] text-white/50">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? "animate-pulse bg-emerald-400" : "bg-white/30"
              }`}
            />
            {live ? "worker live · recomputing" : "worker idle"}
          </span>
          {digest && (
            <span className="font-mono text-[11px] text-white/35">
              last computed {timeLabel(digest.generated_at)}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-28 md:px-8">
        {loading && !digest && (
          <div className="rounded-2xl border border-white/8 bg-black/40 p-10 text-center">
            <p className="font-mono text-sm text-white/40">waking the worker…</p>
          </div>
        )}
        {error && !digest && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-10 text-center">
            <p className="text-sm text-rose-200/80">{error}</p>
            <p className="mt-2 text-xs text-white/40">
              Start the API with <code className="font-mono">npm run dev</code>{" "}
              in the repo root.
            </p>
          </div>
        )}

        {digest && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Spoilers flagged"
                value={c!.spoiler}
                note="blurred for new readers"
                accent="rose"
                index={0}
              />
              <StatCard
                label="Lore questions"
                value={c!.lore_question}
                note="answered from canon"
                accent="cyan"
                index={1}
              />
              <StatCard
                label="Contradictions"
                value={c!.contradiction}
                note="disputed in-feed"
                accent="amber"
                index={2}
              />
            </div>

            {digest.worst_spoiler && (
              <motion.div
                className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-5 md:p-6"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15, ease }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-rose-200/80">
                  Worst spoiler · Spoils Episode {digest.worst_spoiler.spoils_episode}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  &ldquo;{digest.worst_spoiler.text}&rdquo;
                </p>
                <p className="mt-1 font-mono text-[11px] text-white/40">
                  by {digest.worst_spoiler.author} · hidden from every reader below
                  episode {digest.worst_spoiler.spoils_episode}
                </p>
              </motion.div>
            )}

            <div className="grid gap-8 md:grid-cols-2">
              <DigestList
                title="Lore questions · answered from canon"
                items={digest.questions}
                accent="cyan"
              />
              <DigestList
                title="Contradictions · disputed"
                items={digest.contradictions}
                accent="amber"
              />
            </div>

            <p className="pt-2 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/25">
              {c!.total} comments graded · {digest.source} · the canon memory is
              the same source the live OKX.AI agent uses
            </p>
          </div>
        )}
      </main>
    </>
  );
}

function StatCard({
  label,
  value,
  note,
  accent,
  index,
}: {
  label: string;
  value: number;
  note: string;
  accent: "rose" | "cyan" | "amber";
  index: number;
}) {
  const ring =
    accent === "rose"
      ? "border-rose-400/20"
      : accent === "cyan"
        ? "border-cyan-400/20"
        : "border-amber-400/20";
  const text =
    accent === "rose"
      ? "text-rose-200"
      : accent === "cyan"
        ? "text-cyan-200"
        : "text-amber-200";
  return (
    <motion.div
      className={`rounded-2xl border ${ring} bg-black/50 p-5`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p className={`mt-2 font-mono-statement text-4xl ${text}`}>{value}</p>
      <p className="mt-1 text-xs text-white/40">{note}</p>
    </motion.div>
  );
}

function DigestList({
  title,
  items,
  accent,
}: {
  title: string;
  items: DigestItem[];
  accent: "cyan" | "amber";
}) {
  if (items.length === 0) return null;
  const dot = accent === "cyan" ? "bg-cyan-400/70" : "bg-amber-400/70";
  const border = accent === "cyan" ? "border-cyan-400/15" : "border-amber-400/15";
  return (
    <div className={`rounded-2xl border ${border} bg-black/50 p-5`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
        {title}
      </p>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.comment_id} className="flex items-start gap-2.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-white/75">{item.text}</p>
              <p className="mt-0.5 font-mono text-[10px] text-white/35">
                {item.author}
                {item.spoils_episode != null
                  ? ` · spoils ep ${item.spoils_episode}`
                  : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
