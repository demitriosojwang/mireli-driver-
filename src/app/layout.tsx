import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Msafiri · Driver Onboarding — 7-Point KYD Gate",
  description:
    "Msafiri driver onboarding prototype: 7-Point KYD document verification against NTSA, eCitizen IPRS, DCI and IRA registries, full lifecycle with renewal & auto-suspension, and Uber-style 4-digit boarding PIN.",
  keywords: ["Msafiri", "driver onboarding", "KYD", "NTSA", "PSV", "Kenya", "Mombasa", "boarding PIN"],
  authors: [{ name: "Msafiri" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
