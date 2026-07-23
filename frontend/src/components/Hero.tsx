import Pill from "./ui/Pill";
import { OKX_AGENT_URL } from "@/config";

export default function Hero() {
  return (
    <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden bg-black px-5 pb-24 pt-32 md:min-h-[760px] md:px-6">
      {/* CSS-only background — visible grid + slow gradient mesh + spotlight */}
      <div aria-hidden className="hero-grid absolute inset-0" />
      <div aria-hidden className="hero-mesh absolute inset-0" />
      <div aria-hidden className="hero-spotlight absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <h1 className="mx-auto max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-white md:text-8xl">
          Continuity for serialized webtoon art.
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-white/55 md:text-xl">
          An agent that watches every page you ship, flags what doesn&rsquo;t
          match, and remembers so you never have to.
        </p>
        <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-center">
          <Pill
            href={OKX_AGENT_URL}
            className="w-full justify-center sm:w-auto"
          >
            Use on OKX.AI
          </Pill>
          <Pill
            href="#use"
            variant="outline"
            className="w-full justify-center sm:w-auto"
          >
            See how it works
          </Pill>
        </div>
      </div>
    </section>
  );
}
