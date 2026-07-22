import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Showcase from "@/components/Showcase";
import VideoCards from "@/components/VideoCards";
import HowToUse from "@/components/HowToUse";
import ApiSection from "@/components/ApiSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Showcase />
        <VideoCards />
        <HowToUse />
        <ApiSection />
      </main>
      <Footer />
    </>
  );
}
