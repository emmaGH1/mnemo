import Nav from "@/components/Nav";
import CommunityFeed from "@/components/CommunityFeed";
import Footer from "@/components/Footer";

export default function Home() {
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
