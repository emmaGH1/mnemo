import Link from "next/link";
import { demoProject } from "@/data/demo-project";

const activity = [
  ["Reader protection", "3 comments held at Episode 30"],
  ["Canon coverage", "77 facts mapped across 50 episodes"],
  ["Creator review", "10 comments need context or attention"],
] as const;

export default function Workspace() {
  return (
    <div className="workspace-wash min-h-[calc(100dvh-5rem)]">
      <header className="mx-auto max-w-6xl px-5 pb-12 pt-16 md:px-8 md:pb-16 md:pt-24">
        <div className="grid items-end gap-10 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <p className="text-sm font-medium text-cyan-100/80">Creator workspace</p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-white md:text-7xl">
              Protect every reveal without quieting the conversation.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl">
              Mnemo gives serialized-story teams one place to manage canon,
              preview what readers see, and review community conversations that
              need attention.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/projects/lore-olympus"
                className="inline-flex items-center justify-center rounded-full bg-cyan-100 px-6 py-3 text-sm font-semibold text-[#06110f] transition hover:bg-white"
              >
                Open demo project
              </Link>
              <Link
                href="/reader"
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Preview the reader experience
              </Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-[#0a0e0d]/90 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.35)] md:p-6">
            <p className="text-sm font-semibold text-white">Workspace at a glance</p>
            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8">
              <Metric value="1" label="Project" />
              <Metric value="20" label="Comments analyzed" />
              <Metric value="5" label="Spoilers mapped" />
              <Metric value="3" label="Lore questions" />
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-white/45">
              This workspace uses authored demo comments and cached verdicts from
              a real Minds classification run.
            </p>
          </aside>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Projects</h2>
            <p className="mt-1 text-sm text-white/45">Choose a story world to manage.</p>
          </div>
          <button
            type="button"
            disabled
            title="Project creation is not included in this demo"
            className="cursor-not-allowed rounded-full border border-white/10 px-4 py-2 text-sm text-white/35"
          >
            New project · private beta
          </button>
        </div>

        <article className="group overflow-hidden rounded-3xl border border-white/10 bg-[#080b0a]/90 transition hover:border-cyan-200/25">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-cyan-100/10 px-3 py-1 text-xs font-medium text-cyan-100">
                  {demoProject.label}
                </span>
                <span className="text-xs text-white/35">Ready to explore</span>
              </div>
              <h3 className="mt-6 font-display text-4xl font-bold tracking-tight text-white">
                {demoProject.name}
              </h3>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-white/55">
                {demoProject.description}
              </p>
              <div className="mt-7 flex flex-wrap gap-5 text-sm text-white/50">
                <span><strong className="text-white">{demoProject.episodes}</strong> episodes</span>
                <span><strong className="text-white">{demoProject.canonFacts}</strong> canon facts</span>
                <span><strong className="text-white">{demoProject.comments}</strong> seeded comments</span>
              </div>
              <Link
                href="/projects/lore-olympus"
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 transition group-hover:text-white"
              >
                Open project <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="border-t border-white/8 bg-white/[0.02] p-6 lg:border-l lg:border-t-0 md:p-8">
              <p className="text-sm font-semibold text-white">Recent project signals</p>
              <ul className="mt-5 space-y-5">
                {activity.map(([label, value]) => (
                  <li key={label} className="border-b border-white/8 pb-5 last:border-0 last:pb-0">
                    <p className="text-xs text-white/35">{label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/70">{value}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#0a0e0d] p-4">
      <dt className="text-xs text-white/40">{label}</dt>
      <dd className="mt-2 font-display text-3xl font-bold text-white">{value}</dd>
    </div>
  );
}
