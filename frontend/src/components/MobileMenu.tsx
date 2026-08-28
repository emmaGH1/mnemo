"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  links: { label: string; href: string }[];
};

const ease = [0.32, 0.72, 0, 1] as const;

export default function MobileMenu({ open, onClose, links }: MobileMenuProps) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease }}
          className="fixed inset-0 z-50 flex flex-col bg-black/96"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_20%,rgba(255,255,255,0.06),transparent_60%)]"
          />

          <button
            onClick={onClose}
            aria-label="Close menu"
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center text-white/70 transition-colors hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 4L16 16M16 4L4 16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <nav className="relative flex flex-1 flex-col items-center justify-center gap-2">
            {links.map((l, i) => (
              <motion.div
                key={l.label}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.4, delay: 0.06 + i * 0.06, ease }}
              >
                <Link
                  href={l.href}
                  onClick={onClose}
                  className="block px-4 py-3 font-display text-4xl font-bold tracking-tight text-white/90 transition-colors hover:text-white sm:text-5xl"
                >
                  {l.label}
                </Link>
              </motion.div>
            ))}
          </nav>

          <motion.div
            className="relative px-6 pb-10 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/35"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28, ease }}
          >
            77 canon facts · 50 episodes · reader-aware
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
