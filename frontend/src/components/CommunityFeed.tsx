"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

type Verdict = "safe" | "spoiler" | "lore_question" | "contradiction";

type Moderation = {
  verdict: Verdict;
  spoils_episode?: number;
  evidence_episode?: number;
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
  protected?: boolean;
  moderation: Moderation;
};

type Feed = {
  series_id: string;
  reader_episode: number;
  comments: FeedComment[];
};

type CanonFact = { label: string; fact: string; established_episode?: number };
type CanonAnswer = {
  question: string;
  answer: string;
  source: "canon";
  facts: CanonFact[];
  blocked_until_episode?: number;
};

const MAX_EPISODE = 50;
const DEFAULT_EPISODE = 30;
const PROOF_COMMENT_ID = "c11";

const ease = [0.32, 0.72, 0, 1] as const;

const CHIP_BASE = "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]";
const CHIP_STYLE: Record<Verdict, string> = {
  safe: "border-white/20 bg-white/5 text-white/70",
  spoiler: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  lore_question: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  contradiction: "border-amber-400/30 bg-amber-400/10 text-amber-200",
};

export default function CommunityFeed() {
  const [episode, setEpisode] = useState(DEFAULT_EPISODE);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Map<string, string>>(new Map());
  const [proofCommentFocused, setProofCommentFocused] = useState(false);
  const [proofRevealCompleted, setProofRevealCompleted] = useState(false);
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [liveResult, setLiveResult] = useState<{
    comment: FeedComment;
    reader_episode: number;
  } | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
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
        setRevealed(new Map());
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
    const nextEpisode = Math.min(MAX_EPISODE, Math.max(1, ep));
    setEpisode(nextEpisode);
    if (nextEpisode === DEFAULT_EPISODE) {
      setProofRevealCompleted(false);
      setProofCommentFocused(false);
    }
    load(nextEpisode);
  };

  const focusProofComment = () => {
    setProofCommentFocused(true);
    document.getElementById(`comment-${PROOF_COMMENT_ID}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const reveal = async (comment: FeedComment) => {
    if (revealed.has(comment.id)) return;
    if (!comment.protected) {
      setRevealed((prev) => new Map(prev).set(comment.id, comment.text));
      return;
    }
    try {
      const res = await fetch("/api/community/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_id: comment.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Reveal failed (${res.status})`);
      setRevealed((prev) => new Map(prev).set(comment.id, body.text as string));
      if (comment.id === PROOF_COMMENT_ID) setProofRevealCompleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reveal failed");
    }
  };

  const proofState =
    episode === 50 && proofRevealCompleted
      ? 3
      : proofRevealCompleted
        ? 2
        : 1;

  const submit = async () => {
    const text = draft.trim();
    if (!text || checking) return;
    setChecking(true);
    setLiveError(null);
    setLiveResult(null);
    try {
      const res = await fetch("/api/moderation/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text, reader_episode: episode }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          body?.error?.[0] ?? body?.error ?? `Moderation failed (${res.status})`
        );
      }
      setLiveResult({
        reader_episode: body.reader_episode as number,
        comment: {
          id: `live-${Date.now()}`,
          author: "you",
          initials: "yo",
          color: "#ffffff",
          text: body.comment as string,
          time: "just now",
          likes: 0,
          replies: 0,
          moderation: {
            verdict: body.verdict,
            spoils_episode: body.spoils_episode,
            reason: body.reason,
          },
        },
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setLiveError(
        /credits|conversion mode|can't classify|locked to|</i.test(raw)
          ? "Live check is paused — Mnemo's Mind needs cognition credits. The seeded feed below uses cached verdicts."
          : raw
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <header className="section-immersive relative mx-auto max-w-3xl px-5 pb-10 pt-20 md:px-8 md:pt-28">
        <p className="font-mono-statement text-[11px] uppercase tracking-[0.18em] text-white/40">
          Mnemo · reader mode
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white md:text-6xl">
          The Lore Olympus community feed
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/50 md:text-lg">
          Canon-aware moderation for 77 seeded facts across 50 episodes. Move
          your progress and the feed changes with you—without exposing the text
          you have not chosen to reveal.
        </p>

        <section
          aria-labelledby="proof-title"
          className="mt-10 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.045] p-5 shadow-[0_18px_80px_rgba(34,211,238,0.04)] backdrop-blur-md md:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono-statement text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">
                Judge path · 30 seconds
              </p>
              <h2 id="proof-title" className="mt-2 font-display text-2xl font-bold text-white">
                Try the proof
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/55">
                The same comment is protected at Episode 30, revealed only by
                consent, then naturally clears when the reader reaches Episode 50.
              </p>
            </div>
            <span className="rounded-full border border-cyan-200/20 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100/70">
              step {proofState} / 3
            </span>
          </div>

          <ol className="mt-5 grid gap-3 md:grid-cols-3" aria-label="Guided spoiler-safety proof">
            <ProofStep
              number="01"
              label="Start at Episode 30"
              detail="The future reveal is held back."
              active={proofState === 1}
              complete={episode === 30 || proofState > 1}
              action="Set EP 30"
              onClick={() => changeEpisode(DEFAULT_EPISODE)}
            />
            <ProofStep
              number="02"
              label="Reveal one protected comment"
              detail="Consent reveals the text; nothing is sent in the feed payload."
              active={proofState === 1 && proofCommentFocused}
              complete={proofRevealCompleted}
              action={proofRevealCompleted ? "Revealed" : "Find EP 47 comment"}
              onClick={focusProofComment}
            />
            <ProofStep
              number="03"
              label="Move to Episode 50"
              detail="The protection boundary clears because the reveal is now known."
              active={proofState === 2}
              complete={proofState === 3}
              action="Set EP 50"
              onClick={() => changeEpisode(50)}
            />
          </ol>
        </section>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/60 p-5 backdrop-blur-md md:p-6">
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
          {feed && (
            <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 font-mono text-[10px] uppercase tracking-[0.14em]">
              <span className={feed.comments.some((c) => c.protected) ? "text-rose-200/80" : "text-emerald-200/80"}>
                {feed.comments.filter((c) => c.protected).length === 0
                  ? "All seeded comments are clear"
                  : `${feed.comments.filter((c) => c.protected).length} future reveals held back`}
              </span>
              <span className="text-white/30">reader boundary · ep {feed.reader_episode}</span>
            </div>
          )}
        </div>

        <section aria-labelledby="architecture-title" className="mt-6 border-y border-white/10 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="font-mono-statement text-[10px] uppercase tracking-[0.18em] text-white/35">
                What makes the proof work
              </p>
              <h2 id="architecture-title" className="mt-1 font-display text-xl font-bold text-white">
                One moderation run, five connected layers
              </h2>
            </div>
            <Link href="/digest" className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200/80 transition hover:text-cyan-100">
              See the creator payoff →
            </Link>
          </div>
          <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
            {[
              "Continuity engine",
              "Episode-proven canon",
              "Minds semantic classifier",
              "Reader-relative protection",
              "Creator digest",
            ].map((layer, index) => (
              <li key={layer} className="flex items-center gap-2">
                <span className={index === 3 ? "text-cyan-100" : ""}>{layer}</span>
                {index < 4 && <span aria-hidden className="text-white/20">→</span>}
              </li>
            ))}
          </ol>
        </section>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-10 md:px-8">
        <div className="rounded-2xl border border-white/10 bg-black/60 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono-statement text-[11px] uppercase tracking-[0.18em] text-white/40">
              Live classifier · metered Mind call
            </p>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/40">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />
              as someone on Episode {episode}
            </span>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Type a comment — try a spoiler, or ask a lore question…"
            className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-white/30 focus:border-white/25"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p
              className={`font-mono text-[11px] text-white/35 ${
                checking ? "" : "opacity-0"
              }`}
            >
              <span className="animate-pulse">
                the Mind is reading this against canon…
              </span>
            </p>
            <button
              onClick={submit}
              disabled={checking || !draft.trim()}
              className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors duration-200 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking ? "Classifying…" : "Check comment"}
            </button>
          </div>

          {liveError && (
            <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/5 px-4 py-2 text-xs text-rose-200/80">
              {liveError}
            </p>
          )}

          {liveResult && (
            <div className="mt-4">
              <CommentCard
                comment={
                  revealed.has(liveResult.comment.id)
                    ? {
                        ...liveResult.comment,
                        text: revealed.get(liveResult.comment.id)!,
                      }
                    : liveResult.comment
                }
                episode={liveResult.reader_episode}
                blurred={
                  liveResult.comment.moderation.verdict === "spoiler" &&
                  !revealed.has(liveResult.comment.id)
                }
                onReveal={() => void reveal(liveResult.comment)}
                index={0}
                alwaysChip
              />
            </div>
          )}
        </div>
      </section>

      <main id="feed" className="mx-auto max-w-3xl px-5 pb-28 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="font-mono-statement text-[11px] uppercase tracking-[0.18em] text-white/40">
            Seeded feed · cached Mind verdicts
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
                comment={
                  revealed.has(c.id) ? { ...c, text: revealed.get(c.id)! } : c
                }
                episode={feed.reader_episode}
                blurred={c.moderation.verdict === "spoiler" && !revealed.has(c.id)}
                onReveal={() => void reveal(c)}
                index={i}
                highlighted={c.id === PROOF_COMMENT_ID && proofCommentFocused}
              />
            ))}
            <p className="pt-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/25">
              Seeded demo comments · verdicts cached from the real Mind at episode 1
            </p>
          </div>
        )}

        <section className="mt-12 rounded-2xl border border-cyan-300/15 bg-black/55 p-5 md:p-6">
          <p className="font-mono-statement text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">
            Reader feed → creator digest
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-white">
            The creator sees the same moderation run, not another product.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            Reader protection happens at the moment of conversation. The digest
            turns those cached Mind verdicts into the creator&rsquo;s review queue:
            spoilers, lore questions, and disputed canon.
          </p>
          <Link
            href="/digest"
            className="mt-5 inline-flex rounded-full border border-cyan-200/25 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-200/10"
          >
            Continue to creator digest →
          </Link>
        </section>

        <section className="mt-6 border-t border-white/10 pt-8">
          <p className="font-mono-statement text-[10px] uppercase tracking-[0.18em] text-white/35">
            Built on Mnemo&rsquo;s canon engine
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-white">
            Continuity checking became the provenance layer.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
            Mnemo began by checking whether serialized stories stayed consistent.
            That work established the durable technical foundation here: canon
            facts carry the episode that proved them. Minds supplies the semantic
            judgment; the canon engine supplies the exact reader boundary.
          </p>
        </section>
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
  alwaysChip = false,
  highlighted = false,
}: {
  comment: FeedComment;
  episode: number;
  blurred: boolean;
  onReveal: () => void;
  index: number;
  alwaysChip?: boolean;
  highlighted?: boolean;
}) {
  const v = c.moderation.verdict;
  const chip =
    v === "spoiler" || (v === "safe" && !alwaysChip)
      ? null
      : { label: v === "safe" ? "Safe" : v === "lore_question" ? "Answered from canon" : "Disputed" };

  const [answer, setAnswer] = useState<CanonAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setAnswer(null);
    setAnswerError(null);
    setShowAnswer(false);
  }, [episode]);

  const askCanon = async () => {
    if (asking) return;
    if (answer) {
      setShowAnswer(!showAnswer);
      return;
    }
    setAsking(true);
    setAnswerError(null);
    try {
      const res = await fetch("/api/canon/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: c.text, reader_episode: episode }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          body?.error?.[0] ?? body?.error ?? `Canon lookup failed (${res.status})`
        );
      }
      setAnswer(body as CanonAnswer);
      setShowAnswer(true);
    } catch (e) {
      setAnswerError(e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  };

  return (
    <motion.article
      id={`comment-${c.id}`}
      className={`rounded-2xl border bg-black/50 p-4 transition-colors md:p-5 ${
        highlighted ? "border-cyan-300/60 ring-1 ring-cyan-300/25" : "border-white/8"
      }`}
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
        {chip &&
          (v === "lore_question" ? (
            <button
              onClick={askCanon}
              className={`${CHIP_BASE} ${CHIP_STYLE.lore_question} transition hover:brightness-125`}
              aria-label="Get the canon answer"
            >
              {asking ? "Looking…" : "Answered from canon"}
            </button>
          ) : (
            <span className={`${CHIP_BASE} ${CHIP_STYLE[v]}`}>{chip.label}</span>
          ))}
      </div>

      {blurred ? (
        <BlurredText episode={episode} spoilsEpisode={c.moderation.spoils_episode} onReveal={onReveal} />
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-white/80">{c.text}</p>
      )}

      {answerError && (
        <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-xs text-rose-200/80">
          {answerError}
        </p>
      )}

      {v === "lore_question" && answer && showAnswer && (
        <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
              Answered from canon · source: canon
            </p>
            <button
              onClick={() => setShowAnswer(false)}
              className="font-mono text-[10px] text-white/40 hover:text-white"
            >
              hide
            </button>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">
            {answer.answer}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {answer.facts.map((f, i) => (
              <span key={i} className="font-mono text-[10px] text-white/40">
                {f.label}
                {f.established_episode != null ? ` · ep ${f.established_episode}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {(v !== "safe" || alwaysChip) && !blurred && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          {v !== "lore_question" && (
            <span className={`${CHIP_BASE} ${CHIP_STYLE[v]}`}>
              {v === "spoiler"
                ? `Spoils Episode ${c.moderation.spoils_episode}`
                : v === "contradiction"
                  ? "Disputed"
                  : "Safe"}
            </span>
          )}
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

function ProofStep({
  number,
  label,
  detail,
  action,
  active,
  complete,
  onClick,
}: {
  number: string;
  label: string;
  detail: string;
  action: string;
  active: boolean;
  complete: boolean;
  onClick: () => void;
}) {
  return (
    <li className={`rounded-xl border p-3 ${active ? "border-cyan-300/35 bg-cyan-300/[0.06]" : "border-white/8 bg-black/30"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] text-white/35">{number}</span>
        {complete && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-200/80">ready</span>}
      </div>
      <p className="mt-2 text-sm font-medium text-white/85">{label}</p>
      <p className="mt-1 min-h-10 text-xs leading-relaxed text-white/45">{detail}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100 transition hover:text-white"
      >
        {action} →
      </button>
    </li>
  );
}

function BlurredText({
  episode,
  spoilsEpisode,
  onReveal,
}: {
  episode: number;
  spoilsEpisode?: number;
  onReveal: () => void;
}) {
  return (
    <div className="relative mt-3 overflow-hidden rounded-xl border border-rose-400/10 bg-white/[0.03]">
      <div aria-hidden className="space-y-2 px-4 py-4 opacity-30">
        <span className="block h-2 w-11/12 rounded-full bg-white/25" />
        <span className="block h-2 w-8/12 rounded-full bg-white/15" />
      </div>
      <button
        onClick={onReveal}
        className="absolute inset-0 flex w-full flex-col items-center justify-center gap-2"
        aria-label="Reveal spoiler comment"
      >
        <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-200">
          Spoils Episode {spoilsEpisode} · you're on{" "}
          {episode}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">
          Tap to reveal
        </span>
      </button>
    </div>
  );
}
