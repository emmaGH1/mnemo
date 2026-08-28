import type { Metadata } from "next";
import Nav from "@/components/Nav";
import ProjectOverview from "@/components/ProjectOverview";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Lore Olympus project — Mnemo",
  description: "Explore the seeded Lore Olympus creator project in Mnemo.",
};

export default function LoreOlympusProjectPage() {
  return (
    <>
      <Nav />
      <ProjectOverview />
      <Footer />
    </>
  );
}
