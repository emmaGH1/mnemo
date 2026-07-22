"use client";

import { useState } from "react";

type Lang = "python" | "ts" | "bash";

type Sample = { label: string; lang: Lang; code: string };

const KEYWORDS: Record<Lang, string[]> = {
  python: ["from", "import", "def", "async", "await", "return", "print"],
  ts: ["import", "from", "const", "export", "async", "await", "new", "type"],
  bash: ["curl"],
};

const SAMPLES: Sample[] = [
  {
    label: "Python",
    lang: "python",
    code: `# SDK coming soon
from mnemo import Mnemo

client = Mnemo(api_key=os.getenv("MNEMO_API_KEY"))

result = client.check(
    series_id="lore-olympus",
    page="ep003_p08.png",
    dialogue="Hades looked at her, surprised."
)
print(result.flags, result.canon_additions)`,
  },
  {
    label: "TypeScript",
    lang: "ts",
    code: `// SDK coming soon
import { Mnemo } from "mnemo";

const client = new Mnemo({ apiKey: process.env.MNEMO_API_KEY! });

const result = await client.check({
  seriesId: "lore-olympus",
  page: "ep003_p08.png",
  dialogue: "Hades looked at her, surprised.",
});
console.log(result.flags, result.canonAdditions);`,
  },
  {
    label: "cURL",
    lang: "bash",
    code: `# SDK coming soon
curl -X POST https://api.mnemo.dev/mcp \\
  -H "Authorization: Bearer $MNEMO_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "check-continuity",
      "arguments": {
        "series_id": "lore-olympus",
        "page_image_base64": "...",
        "mime_type": "image/png"
      }
    }
  }'`,
  },
];

function highlight(code: string, lang: Lang) {
  const re = new RegExp(
    `(#[^\\n]*|\\/\\/[^\\n]*)|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|\\b(${KEYWORDS[
      lang
    ].join("|")})\\b`,
    "g"
  );
  const out: { text: string; cls: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last)
      out.push({ text: code.slice(last, m.index), cls: "text-white" });
    out.push({
      text: m[0],
      cls: m[1] ? "text-white/30" : m[2] ? "text-[#ffd166]" : "text-[#ff6b6b]",
    });
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last), cls: "text-white" });
  return out;
}

export default function CodeBlock() {
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLES[tab].code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (non-secure context) — no-op
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-black">
      {/* chrome */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-white/50 transition-colors duration-150 hover:text-white"
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
      </div>

      {/* code */}
      <div className="relative">
        <pre className="max-h-[380px] overflow-auto p-5 font-mono text-sm leading-relaxed md:max-h-none">
          <code>
            {highlight(SAMPLES[tab].code, SAMPLES[tab].lang).map((t, i) => (
              <span key={i} className={t.cls}>
                {t.text}
              </span>
            ))}
          </code>
        </pre>
        {/* right-edge light leak */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-[linear-gradient(to_left,rgba(255,255,255,0.04),transparent)]" />
      </div>

      {/* tabs */}
      <div className="flex overflow-x-auto border-t border-white/8">
        {SAMPLES.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setTab(i)}
            className={`shrink-0 px-4 py-2 text-sm transition-colors duration-150 ${
              i === tab
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
