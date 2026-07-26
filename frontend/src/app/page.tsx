import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Showcase from "@/components/Showcase";
import VideoCards from "@/components/VideoCards";
import HowToUse from "@/components/HowToUse";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="relative overflow-x-hidden">
        <Hero />
        <Showcase />
        <VideoCards />
        <HowToUse />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
