import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Next.js Auth Starter",
    template: "%s | Next.js Auth Starter",
  },
  description:
    "A comprehensive Next.js boilerplate for authentication, user management, and email verification.",
  applicationName: "Next.js Auth Starter",
  authors: [{ name: "Your Name", url: "https://yourwebsite.com" }], // Customize with your name and website
  keywords: [
    "Next.js",
    "Auth",
    "Authentication",
    "Boilerplate",
    "User Management",
    "Email Verification",
    "Fullstack",
  ],
  openGraph: {
    title: "Next.js Auth Starter",
    description:
      "A comprehensive Next.js boilerplate for authentication, user management, and email verification.",
    url: "https://yourwebsite.com", // Customize with your application's URL
    siteName: "Next.js Auth Starter",
    images: [
      {
        url: "/og-image.png", // Add an Open Graph image to your public directory (e.g., 1200x630px)
        width: 1200,
        height: 630,
        alt: "Next.js Auth Starter",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Next.js Auth Starter",
    description:
      "A comprehensive Next.js boilerplate for authentication, user management, and email verification.",
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
