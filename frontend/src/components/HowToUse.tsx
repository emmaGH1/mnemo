"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Pill from "./ui/Pill";
import Reveal from "./ui/Reveal";
import { OKX_AGENT_URL } from "@/config";

const PROMPT = `I'd like to use the service provided by Agent 6211:

Service title: Continuity Check
Service type: A2MCP
Endpoint: https://mnemo-production-c4f1.up.railway.app/mcp

Please use OKX Agent Payments Protocol to send a request to this endpoint.`;

export default function HowToUse() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (non-secure context) — no-op
    }
  };

  return (
    <section
      id="use"
      className="section-immersive relative scroll-mt-20 px-4 py-24 sm:px-5 md:px-6 md:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_30%,rgba(255,255,255,0.04),transparent_65%)]"
      />
      <Reveal className="relative mx-auto max-w-3xl">
        <div className="text-center">
          <p className="font-mono-statement text-[13px] uppercase tracking-wider text-white/50">
            How to use
          </p>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            Tell your agent.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/55 md:text-xl">
            Copy the prompt below. Paste it to Claude Code, Hermes, OpenClaw,
            or any agent that supports x402. The agent handles the rest.
          </p>
        </div>

        <motion.div
          className="relative mt-12 rounded-2xl border border-white/10 bg-black/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          <div className="relative rounded-[0.9rem] border border-white/[0.06] bg-black/40 p-6 md:p-8">
            <button
              onClick={copy}
              className="absolute right-4 top-4 flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-xs text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copied ? "Copied" : "Copy"}
            </button>
            <pre className="whitespace-pre-wrap pr-16 font-mono text-sm leading-relaxed text-white/85 md:text-base">
              {PROMPT}
            </pre>
          </div>
        </motion.div>

        <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={copy}
            className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-white/15 active:scale-[0.98]"
          >
            {copied ? "Copied ✓" : "Copy prompt"}
          </button>
          <Pill href={OKX_AGENT_URL}>Use on OKX.AI ↗</Pill>
        </div>
      </Reveal>
    </section>
  );
}
