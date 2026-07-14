import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import AIChatButtonWrapper from "@/components/AIChatButtonWrapper";
import AppProviders from "@/components/AppProviders";
import MobileNotSupportedOverlay from "@/components/MobileNotSupportedOverlay";
import { getPublicAppUrl } from "@/lib/publicUrls";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = getPublicAppUrl();

export const metadata: Metadata = {
  ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
  title: {
    default: "Duocards",
    template: "%s | Duocards",
  },
  description:
    "Duocards: Your ultimate flashcard learning web app. Create, organize, and master your knowledge with interactive flashcards.",
  applicationName: "Duocards",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  authors: [
    {
      name: "Your Name",
      ...(appUrl ? { url: appUrl } : {}),
    },
  ], // Customize with your name and website
  keywords: [
    "Duocards",
    "Flashcards",
    "Learning",
    "Study",
    "Education",
    "Memory",
    "Spaced Repetition",
    "Web App",
    "Next.js",
  ],
  openGraph: {
    title: "Duocards - Master Your Knowledge with Flashcards",
    description:
      "Create, organize, and learn effectively with Duocards, the interactive flashcard web app.",
    ...(appUrl ? { url: appUrl } : {}),
    siteName: "Duocards",
    images: [
      {
        url: "/og-image.png", // Add an Open Graph image to your public directory (e.g., 1200x630px)
        width: 1200,
        height: 630,
        alt: "Duocards Flashcard Learning App",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Duocards - Flashcard Learning App",
    description:
      "Boost your learning with Duocards! Create custom flashcards and ace your studies.",
    creator: "@yourtwitterhandle", // Customize with your Twitter handle
    images: ["/twitter-image.png"], // Add a Twitter card image to your public directory (e.g., 1200x675px)
  },
  // You might also want to add a favicon.ico in the public directory
  // icons: {
  //   icon: "/favicon.ico",
  //   shortcut: "/favicon-16x16.png",
  //   apple: "/apple-touch-icon.png",
  // },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppProviders>
          {children}
          <AIChatButtonWrapper />
          <MobileNotSupportedOverlay />
        </AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
