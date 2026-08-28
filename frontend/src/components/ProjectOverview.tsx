import Link from "next/link";
import { demoProject } from "@/data/demo-project";

const setup = [
  { label: "Canon imported", value: `${demoProject.canonFacts} episode-proven facts`, state: "Complete" },
  { label: "Mind classification", value: `${demoProject.comments} genuine cached verdicts`, state: "Ready" },
  { label: "Reader boundary", value: `Episodes 1–${demoProject.episodes}`, state: "Active" },
] as const;

const flow = [
  "Continuity engine",
  "Episode-proven canon",
  "Minds classifier",
  "Reader protection",
  "Creator digest",
] as const;

export default function ProjectOverview() {
  return (
    <div className="workspace-wash min-h-[calc(100dvh-5rem)]">
      <header className="mx-auto max-w-6xl px-5 pb-10 pt-12 md:px-8 md:pb-14 md:pt-18">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/" className="transition hover:text-white">Workspace</Link>
          <span aria-hidden>/</span>
          <span className="text-white/70">{demoProject.name}</span>
        </nav>

        <div className="mt-8 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-cyan-100/10 px-3 py-1 text-xs font-medium text-cyan-100">
                {demoProject.label}
              </span>
              <span className="text-xs text-white/35">Serialized fiction</span>
            </div>
            <h1 className="mt-5 font-display text-5xl font-bold tracking-[-0.04em] text-white md:text-7xl">
              {demoProject.name}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/55">
              One project, two useful views: preview the community at a reader’s
              current episode, then review the same moderation run as a creator.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/reader" className="rounded-full bg-cyan-100 px-6 py-3 text-center text-sm font-semibold text-[#06110f] transition hover:bg-white">
              Open reader preview
            </Link>
            <Link href="/digest" className="rounded-full border border-white/15 px-6 py-3 text-center text-sm font-semibold text-white/75 transition hover:border-white/30 hover:text-white">
              Review digest
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
        <section aria-label="Project statistics" className="grid overflow-hidden rounded-3xl border border-white/10 bg-white/8 sm:grid-cols-3">
          <ProjectMetric value={String(demoProject.episodes)} label="Episodes tracked" />
          <ProjectMetric value={String(demoProject.canonFacts)} label="Canon facts" />
          <ProjectMetric value={String(demoProject.comments)} label="Comments in demo run" />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-white/10 bg-[#080b0a]/90 p-6 md:p-8">
            <h2 className="font-display text-2xl font-bold text-white">Protection setup</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              The pieces Mnemo uses before a comment reaches a reader.
            </p>
            <ul className="mt-6 divide-y divide-white/8">
              {setup.map((item) => (
                <li key={item.label} className="flex items-start justify-between gap-6 py-5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold text-white/85">{item.label}</p>
                    <p className="mt-1 text-sm text-white/40">{item.value}</p>
                  </div>
                  <span className="rounded-full border border-emerald-200/15 bg-emerald-200/5 px-3 py-1 text-xs text-emerald-100/75">
                    {item.state}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#080b0a]/90 p-6 md:p-8">
            <h2 className="font-display text-2xl font-bold text-white">What creators can review</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              The current seeded run is ready in both product views.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <ReviewSignal value={demoProject.spoilers} label="Spoilers mapped" tone="rose" />
              <ReviewSignal value={demoProject.questions} label="Lore questions" tone="cyan" />
              <ReviewSignal value={demoProject.contradictions} label="Canon disputes" tone="amber" />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-white/10 bg-[#080b0a]/90 p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Built on Mnemo’s canon engine</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                Mnemo began as a continuity checker. That provenance layer now
                tells the classifier exactly when a fact became safe for a reader.
              </p>
            </div>
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 text-xs font-medium text-white/50">
              {flow.map((item, index) => (
                <li key={item} className="flex items-center gap-2">
                  <span className={index === 3 ? "text-cyan-100" : ""}>{item}</span>
                  {index < flow.length - 1 && <span aria-hidden className="text-white/20">→</span>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}

function ProjectMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#080b0a] p-6 sm:border-r sm:border-white/8 sm:last:border-0 md:p-8">
      <p className="font-display text-4xl font-bold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/40">{label}</p>
    </div>
  );
}

function ReviewSignal({ value, label, tone }: { value: number; label: string; tone: "rose" | "cyan" | "amber" }) {
  const color = tone === "rose" ? "text-rose-200" : tone === "cyan" ? "text-cyan-200" : "text-amber-200";
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <span className="text-sm text-white/55">{label}</span>
      <strong className={`font-display text-2xl ${color}`}>{value}</strong>
    </div>
  );
}
