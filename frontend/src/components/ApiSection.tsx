import Reveal from "./ui/Reveal";
import CodeBlock from "./ui/CodeBlock";

export default function ApiSection() {
  return (
    <section
      id="api"
      className="border-t border-white/8 px-5 py-20 md:px-6 md:py-32"
    >
      <div className="mx-auto max-w-[600px]">
        <Reveal className="text-center md:text-left">
          <p className="text-xs uppercase tracking-wider text-white/40">
            For developers
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            API for developers
          </h2>
          <p className="mt-3 text-white/45">
            A2MCP — your agent calls Mnemo at the endpoint above via the OKX
            Agent Payments Protocol. No SDK required.
          </p>
        </Reveal>
        <Reveal className="mt-8">
          <CodeBlock />
        </Reveal>
      </div>
    </section>
  );
}
