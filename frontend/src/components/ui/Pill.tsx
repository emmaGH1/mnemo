"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type PillProps = {
  href: string;
  children: React.ReactNode;
  variant?: "solid" | "outline";
  className?: string;
};

export default function Pill({
  href,
  children,
  variant = "solid",
  className = "",
}: PillProps) {
  const external = href.startsWith("http");
  const extra = external
    ? { target: "_blank" as const, rel: "noreferrer" }
    : {};

  if (variant === "solid") {
    const cls = `group inline-flex items-center gap-3 rounded-full bg-white py-2 pl-6 pr-2 text-base font-medium text-black transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/90 active:scale-[0.98] ${className}`;
    const inner = (
      <>
        <span>{children}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 10L10 2M10 2H4.5M10 2V7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </>
    );
    return external ? (
      <motion.a
        href={href}
        className={cls}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        {...extra}
      >
        {inner}
      </motion.a>
    ) : (
      <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
        <Link href={href} className={cls}>
          {inner}
        </Link>
      </motion.div>
    );
  }

  const cls = `inline-flex items-center rounded-full border border-white/15 bg-white/10 px-6 py-2.5 text-base font-medium text-white transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/15 active:scale-[0.98] ${className}`;
  return external ? (
    <motion.a
      href={href}
      className={cls}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      {...extra}
    >
      {children}
    </motion.a>
  ) : (
    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
      <Link href={href} className={cls}>
        {children}
      </Link>
    </motion.div>
  );
}
