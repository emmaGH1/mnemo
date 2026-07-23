"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import Pill from "./ui/Pill";
import { OKX_AGENT_URL } from "@/config";

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  links: { label: string; href: string }[];
};

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
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl"
        >
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center text-white/70 hover:text-white"
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

          <nav className="flex flex-1 flex-col items-center justify-center gap-8">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                onClick={onClose}
                className="text-4xl font-medium text-white/85 transition-colors hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-3 px-6 pb-10">
            <Pill href={OKX_AGENT_URL} className="w-full justify-center">
              Use on OKX.AI
            </Pill>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
