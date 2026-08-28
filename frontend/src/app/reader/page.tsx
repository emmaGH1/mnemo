import type { Metadata } from "next";
import Nav from "@/components/Nav";
import CommunityFeed from "@/components/CommunityFeed";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Reader preview — Mnemo",
  description: "Preview reader-relative spoiler protection for the Lore Olympus demo project.",
};

export default function ReaderPage() {
  return (
    <>
      <Nav />
      <main className="relative overflow-x-hidden">
        <CommunityFeed />
      </main>
      <Footer />
    </>
  );
}
