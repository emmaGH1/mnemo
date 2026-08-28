import Nav from "@/components/Nav";
import Workspace from "@/components/Workspace";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="relative overflow-x-hidden">
        <Workspace />
      </main>
      <Footer />
    </>
  );
}
