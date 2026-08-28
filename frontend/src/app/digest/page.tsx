import Nav from "@/components/Nav";
import Digest from "@/components/Digest";
import Footer from "@/components/Footer";

export default function DigestPage() {
  return (
    <>
      <Nav />
      <main className="relative overflow-x-hidden">
        <Digest />
      </main>
      <Footer />
    </>
  );
}
