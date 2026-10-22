import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Majlis · Real-time AI sales coach",
  description:
    "Private, real-time AI coaching for live sales calls. Practice with an AI buyer, get guidance during the call, and a scorecard after it.",
};

export const viewport: Viewport = { themeColor: "#07090c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Marcellus&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        <div className="pattern fixed inset-0 -z-10 pointer-events-none" aria-hidden />
        <div className="tricolor fixed top-0 left-0 right-0 h-[3px] z-50 opacity-80" aria-hidden />
        <Nav />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">{children}</main>
      </body>
    </html>
  );
}
