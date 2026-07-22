import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Mnemo",
  description:
    "Catch continuity breaks before your readers do. Mnemo reads every page you ship, flags what doesn't match, and remembers so you never have to.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
