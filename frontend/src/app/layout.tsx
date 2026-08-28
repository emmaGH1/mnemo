import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque, Rubik_Mono_One, Oi } from "next/font/google";
import Cursor from "@/components/Cursor";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

// Display face — H1/H2/H3. Closest free match to Briola/Britt Grotesk.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

// Statement mono — eyebrows, labels, numerical callouts.
const rubikMono = Rubik_Mono_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-rubik-mono",
});

// Fat display — ONE moment only (the price callout).
const oi = Oi({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-oi",
});

export const metadata: Metadata = {
  title: "Mnemo — Spoiler-aware canon intelligence",
  description:
    "Reader-relative spoiler protection powered by episode-proven canon and Minds semantic classification.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bricolage.variable} ${rubikMono.variable} ${oi.variable}`}
    >
      <body className="bg-black text-white antialiased" suppressHydrationWarning>
        {children}
        <div aria-hidden className="site-grain" />
        <Cursor />
      </body>
    </html>
  );
}
