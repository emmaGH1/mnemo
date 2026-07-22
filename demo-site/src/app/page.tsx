import Hero from "../components/Hero";
import Checker from "../components/Checker";
import WatcherLog from "../components/WatcherLog";
import HowItWorks from "../components/HowItWorks";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <main className="relative">
      <Hero />
      <Checker />
      <WatcherLog />
      <HowItWorks />
      <Footer />
    </main>
  );
}
