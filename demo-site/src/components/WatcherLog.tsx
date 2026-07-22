"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Flag {
  severity: string;
  character: string;
  field: string;
  canon_value: string;
  new_value: string;
  explanation: string;
}

interface AlertEntry {
  episode: number;
  panel: number;
  page_file: string;
  flags: Flag[];
  canon_additions: { type: string; data: Record<string, unknown> }[];
  checked_at: string;
}

interface AlertLog {
  series_id: string;
  watched_since_episode: number;
  alerts: AlertEntry[];
  total_flags: number;
  total_additions: number;
  stats: {
    pages_checked: number;
    pages_with_flags: number;
    pages_with_additions: number;
    pages_clean: number;
  };
}

const sev: Record<string, { box: string; text: string }> = {
  high: { box: "border-red-500/25 bg-red-500/[0.06]", text: "text-red-400" },
  medium: { box: "border-amber-500/25 bg-amber-500/[0.06]", text: "text-amber-400" },
  low: { box: "border-blue-500/25 bg-blue-500/[0.06]", text: "text-blue-400" },
};

export default function WatcherLog() {
  const [log, setLog] = useState<AlertLog | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/demo/alert-log?series_id=lore-olympus")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setLog)
      .catch(() => setError(true));
  }, []);

  return (
    <section id="watcher" className="relative py-24 md:py-36 px-5">
      <div className="absolute top-1/4 right-[-10%] w-[450px] h-[450px] rounded-full bg-[var(--lamp-dim)] blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 28, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="eyebrow mb-5">The watcher</div>
          <h2 className="display text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            It was watching
            <br />
            <span className="gradient-text">while the artist drew.</span>
          </h2>
          <p className="text-white/45 max-w-lg mx-auto text-sm md:text-base leading-relaxed">
            Mnemo silently checked Lore Olympus Episode 3 against established canon.
            Nobody asked it to. Here&apos;s what it found.
          </p>
        </motion.div>

        {error && (
          <div className="glass rounded-3xl p-6 text-center text-white/35 text-sm">
            Watcher log unavailable — is the Mnemo API running on :3000?
          </div>
        )}

        {log && (
          <>
            {/* stats */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-12"
            >
              {[
                { label: "pages checked", value: log.stats.pages_checked },
                { label: "flags raised", value: log.total_flags },
                { label: "canon additions", value: log.total_additions },
                { label: "episode watched", value: log.watched_since_episode },
              ].map((s, i) => (
                <div key={i} className="glass rounded-3xl p-5 md:p-7 text-center">
                  <div className="display text-3xl md:text-4xl font-semibold gradient-text">{s.value}</div>
                  <div className="text-[10px] text-white/35 uppercase tracking-[0.15em] mt-2">{s.label}</div>
                </div>
              ))}
            </motion.div>

            {/* timeline */}
            <div className="space-y-4">
              {log.alerts
                .filter((a) => a.flags.length > 0 || a.canon_additions.length > 0)
                .map((entry, i) => (
                  <motion.div
                    key={entry.page_file}
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.6, delay: Math.min(i * 0.05, 0.3), ease: [0.32, 0.72, 0, 1] }}
                  >
                    <div className={entry.flags.length > 0 ? "bezel" : ""}>
                      <div className={`${entry.flags.length > 0 ? "core rounded-[calc(2rem-0.375rem)]" : "glass rounded-3xl"} p-5 md:p-6`}>
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-[10px] font-mono text-white/40 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full tracking-wider">
                              EP {entry.episode} · PANEL {entry.panel}
                            </span>
                            {entry.flags.length > 0 ? (
                              <span className="text-[11px] font-semibold text-red-400">
                                {entry.flags.length} flag{entry.flags.length > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-amber-400/70">canon grew</span>
                            )}
                          </div>
                          <span className="text-[10px] text-white/20 font-mono">{entry.page_file}</span>
                        </div>

                        <div className="space-y-2.5">
                          {entry.flags.map((f, j) => (
                            <div key={j} className={`rounded-2xl p-4 border ${sev[f.severity]?.box ?? sev.low.box}`}>
                              <div className={`flex items-center gap-2 text-sm font-semibold mb-1.5 ${sev[f.severity]?.text ?? sev.low.text}`}>
                                <span className="uppercase text-[9px] tracking-[0.15em] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10">{f.severity}</span>
                                <span className="display text-white/90">{f.character}</span>
                                <span className="text-white/35">— {f.field}</span>
                              </div>
                              <div className="text-sm font-medium">
                                <span className="line-through opacity-40">{f.canon_value}</span>
                                <span className="mx-2 opacity-30">→</span>
                                <span>{f.new_value}</span>
                              </div>
                              <p className="text-xs text-white/45 mt-2 leading-relaxed">{f.explanation}</p>
                            </div>
                          ))}

                          {entry.canon_additions.map((a, j) => (
                            <div key={`a-${j}`} className="rounded-xl px-4 py-2.5 bg-white/[0.02] border border-white/5 text-sm flex gap-2.5">
                              <span className="text-amber-400/80 font-medium shrink-0">{a.type}</span>
                              <span className="text-white/45">{String(a.data.field ?? "")}: {String(a.data.value ?? "")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 }}
              className="text-center text-white/25 text-sm mt-12 display italic"
            >
              The artist never opened a dashboard. Mnemo just remembered.
            </motion.p>
          </>
        )}
      </div>
    </section>
  );
}
