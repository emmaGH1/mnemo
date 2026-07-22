"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Flag {
  severity: "low" | "medium" | "high";
  character: string;
  field: string;
  canon_value: string;
  new_value: string;
  ep_ref?: number;
  panel_ref?: number;
  explanation: string;
}

interface Addition {
  type: string;
  data: Record<string, unknown>;
}

interface CheckResult {
  flags: Flag[];
  canon_additions: Addition[];
}

const severityStyles: Record<string, string> = {
  high: "border-red-500/25 bg-red-500/[0.06]",
  medium: "border-amber-500/25 bg-amber-500/[0.06]",
  low: "border-blue-500/25 bg-blue-500/[0.06]",
};
const severityText: Record<string, string> = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-blue-400",
};

export default function Checker() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function runCheck(file: File | Blob, name = "page.jpg") {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("page_image", file, name);
      fd.append("series_id", "lore-olympus");
      const res = await fetch("/api/check", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (e: any) {
      setError(e.message ?? "Check failed");
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    runCheck(file, file.name);
  }

  async function handleSample(e: React.MouseEvent) {
    e.stopPropagation();
    setPreview("/sample-page.jpg");
    const blob = await (await fetch("/sample-page.jpg")).blob();
    runCheck(blob, "sample-page.jpg");
  }

  return (
    <section id="checker" className="relative py-24 md:py-36 px-5">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="eyebrow mb-5">Live demo</div>
          <h2 className="display text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Drop a page. Watch it think.
          </h2>
          <p className="text-white/45 max-w-lg mx-auto text-sm md:text-base leading-relaxed">
            This hits the real Mnemo checker — Gemini 2.5 Flash reads your page
            against the Lore Olympus canon in seconds.
          </p>
        </motion.div>

        {/* upload vitrine */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
          className="bezel"
        >
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileInput.current?.click()}
            className={`core interactive rounded-[calc(2rem-0.375rem)] p-8 md:p-12 text-center cursor-pointer ${
              dragging ? "bg-amber-500/[0.05] border-amber-500/30 scale-[1.005]" : "hover:bg-white/[0.02]"
            }`}
          >
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="w-12 h-12 mx-auto mb-5 rounded-2xl glass flex items-center justify-center text-xl">✦</div>
            <p className="font-semibold mb-1.5 display text-lg">Drag a webtoon page here</p>
            <p className="text-xs text-white/35 mb-6 tracking-wide">PNG · JPEG · WebP</p>
            <button
              onClick={handleSample}
              className="group inline-flex items-center gap-2 pl-5 pr-1.5 py-1.5 rounded-full glass text-sm font-medium active:scale-[0.98]"
            >
              or try a Lore Olympus page
              <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs transition-transform duration-500 group-hover:translate-x-1">
                →
              </span>
            </button>
          </div>
        </motion.div>

        {/* loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 glass rounded-3xl p-8 text-center"
            >
              <div className="inline-block w-5 h-5 border-[1.5px] border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-white/50 text-sm">Mnemo is reading the page against canon…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-6 glass rounded-3xl p-5 border-red-500/25 text-red-300 text-sm text-center">
            {error} — is the Mnemo API running on :3000?
          </div>
        )}

        {/* results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
              className="mt-8 grid md:grid-cols-2 gap-6 items-start"
            >
              {preview && (
                <div className="bezel">
                  <div className="core rounded-[calc(2rem-0.375rem)] p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Checked page" className="rounded-2xl w-full max-h-[70vh] object-contain bg-black/40" />
                  </div>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <h3 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-3">
                    {result.flags.length === 0 ? "✓ No contradictions" : `${result.flags.length} flag${result.flags.length > 1 ? "s" : ""} raised`}
                  </h3>
                  <div className="space-y-3">
                    {result.flags.map((f, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                        className={`rounded-2xl p-5 border ${severityStyles[f.severity] ?? severityStyles.low}`}
                      >
                        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                          <span className={`text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${severityText[f.severity]}`}>
                            {f.severity}
                          </span>
                          <span className="font-semibold display">{f.character}</span>
                          <span className="text-white/35 text-sm">· {f.field}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm mb-2.5 font-medium">
                          <span className="line-through text-white/35">{f.canon_value}</span>
                          <span className="text-white/25">→</span>
                          <span>{f.new_value}</span>
                        </div>
                        <p className="text-[13px] text-white/55 leading-relaxed">{f.explanation}</p>
                        {f.ep_ref != null && (
                          <p className="text-[11px] text-white/25 mt-2.5 font-mono">est. EP {f.ep_ref}{f.panel_ref != null ? ` · PANEL ${f.panel_ref}` : ""}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {result.canon_additions.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-3">
                      + {result.canon_additions.length} new canon fact{result.canon_additions.length > 1 ? "s" : ""}
                    </h3>
                    <div className="space-y-2">
                      {result.canon_additions.map((a, i) => (
                        <div key={i} className="rounded-xl px-4 py-3 glass text-sm flex gap-2.5">
                          <span className="text-amber-400/90 font-medium shrink-0">{a.type}</span>
                          <span className="text-white/50">{String(a.data.field ?? "")}: {String(a.data.value ?? "")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
