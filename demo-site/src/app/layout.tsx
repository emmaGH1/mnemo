import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mnemo — Continuity Checker for Webtoon Artists",
  description: "The second brain that watches your comic for continuity errors. Built on OKX.AI ASP.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700,500&f[]=satoshi@400,500,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
