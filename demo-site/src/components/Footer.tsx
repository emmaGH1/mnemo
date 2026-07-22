export default function Footer() {
  return (
    <footer className="relative py-14 px-5 border-t border-white/5">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="text-center md:text-left">
          <span className="display text-base font-semibold">
            Mnemo<span className="text-amber-500">.</span>
          </span>
          <p className="text-[11px] text-white/25 mt-1.5">Continuity memory for serialized comics.</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-white/35 flex-wrap justify-center">
          <span className="glass px-3 py-1.5 rounded-full">OKX.AI Hackathon</span>
          <span>Gemini 2.5 Flash</span>
          <span>x402</span>
        </div>
      </div>
    </footer>
  );
}
