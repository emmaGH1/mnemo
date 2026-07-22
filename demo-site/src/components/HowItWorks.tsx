"use client";

import { motion } from "framer-motion";

const steps = [
  {
    n: "01",
    title: "Register your series",
    body: "Point Mnemo at your webtoon. It builds a canon — every eye color, outfit, scar, and the exact panel that established it.",
  },
  {
    n: "02",
    title: "Mnemo watches new pages",
    body: "Every page is read against canon by Gemini 2.5 Flash. Contradictions flagged, new facts absorbed, art noise ignored.",
  },
  {
    n: "03",
    title: "You get the alert",
    body: "Your agent pulls the log whenever it wants. No dashboards, no babysitting. You keep drawing; it remembers.",
  },
];

const tools = [
  { name: "check-continuity", desc: "Check one page against canon. Returns flags + canon additions." },
  { name: "register-series", desc: "Register a webtoon for watcher monitoring." },
  { name: "get-alerts", desc: "Pull the continuity alert log for a watched series." },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative py-24 md:py-36 px-5">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="eyebrow mb-5">How it works</div>
          <h2 className="display text-4xl md:text-5xl font-semibold tracking-tight">
            A second brain,
            <br />
            paid per thought.
          </h2>
        </motion.div>

        {/* steps */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-5 mb-14">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.32, 0.72, 0, 1] }}
              className="glass rounded-3xl p-7 md:p-8 hover:bg-white/[0.05] interactive"
            >
              <div className="text-amber-500/50 font-mono text-xs tracking-[0.2em] mb-5">{s.n}</div>
              <h3 className="display text-lg font-semibold mb-3">{s.title}</h3>
              <p className="text-[13px] text-white/45 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>

        {/* MCP tools */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          className="bezel"
        >
          <div className="core rounded-[calc(2rem-0.375rem)] p-6 md:p-9">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-7">
              <h3 className="display font-semibold text-lg">MCP tools — one service, one price</h3>
              <span className="text-[10px] text-white/30 font-mono tracking-wider">x402 · USDT · X Layer (eip155:196)</span>
            </div>
            <div className="space-y-2.5">
              {tools.map((t) => (
                <div key={t.name} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 rounded-2xl bg-black/30 border border-white/5 px-5 py-4">
                  <code className="text-amber-400 font-mono text-[13px] shrink-0">{t.name}</code>
                  <span className="text-[13px] text-white/45 flex-1">{t.desc}</span>
                  <span className="text-[11px] font-mono text-white/30 shrink-0">$0.10 / call</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/25 mt-6 leading-relaxed">
              Agents discover Mnemo via the OKX.AI ASP marketplace, pay per call with x402,
              and get structured JSON back. Humans never touch a dashboard.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
