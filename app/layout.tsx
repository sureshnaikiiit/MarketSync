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
  title: { default: "MarketSync", template: "%s · MarketSync" },
  description: "Real-time multi-market paper trading — India, US & Hong Kong",
  icons: {
    icon:             [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-32.png", sizes: "32x32" }, { url: "/icon-256.png", sizes: "256x256" }],
    apple:            [{ url: "/apple-icon.png", sizes: "256x256" }],
    shortcut:         "/icon-32.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="256x256" href="/apple-icon.png" />
      </head>
      <body className="min-h-full flex flex-col bg-[#161b27]">
        {children}
      </body>
    </html>
  );
}
