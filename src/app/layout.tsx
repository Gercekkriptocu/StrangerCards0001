import type { Metadata } from "next";
import React from "react";
import localFont from "next/font/local";
import "./globals.css";
import { ResponseLogger } from "@/components/response-logger";
import { cookies } from "next/headers";
import { ReadyNotifier } from "@/components/ready-notifier";
import FarcasterWrapper from "@/components/FarcasterWrapper";
import { AppKitProvider, config } from "@/providers";
import { cookieToInitialState } from "wagmi";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// 🔗 Ayarlar
const appUrl = "https://voltpacks.xyz";
const shareImage = "https://i.imgur.com/hTYcwAu.png"; // ✅ İSTEDİĞİN GÖRSEL

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const requestId = cookieStore.get("x-request-id")?.value;
  
  const initialState = cookieToInitialState(config, cookieStore.toString());

  return (
        <html lang="en">
          <head>
            {requestId && <meta name="x-request-id" content={requestId} />}
            <script src="https://w.soundcloud.com/player/api.js" async></script>
          </head>
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          >
            <ReadyNotifier />
            <AppKitProvider initialState={initialState}>
              <FarcasterWrapper>
                {children}
              </FarcasterWrapper>
            </AppKitProvider>
            <ResponseLogger />
          </body>
        </html>
      );
}

// 🔥 METADATA AYARLARI 🔥
export const metadata: Metadata = {
  title: "Stranger Packs",
  description: "Unlock mysterious Stranger cards with our mini app. Mint and reveal exciting cards. Collect them all!",
  openGraph: {
    title: "Stranger Packs",
    description: "Unlock mysterious Stranger cards from the Upside Down.",
    url: appUrl,
    siteName: "Stranger Packs",
    images: [
      {
        url: shareImage, // ✅ Feed Görseli (OpenGraph)
        width: 1200,
        height: 630,
        alt: "Stranger Packs Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: shareImage, // ✅ Farcaster Feed Görseli
      button: {
        title: "Mint Stranger Packs", // ✅ Buton Yazısı
        action: {
          type: "launch_frame",
          name: "Stranger Packs",
          url: appUrl,
          splashImageUrl: shareImage, // ✅ Splash (Açılış) Görseli de aynı yapıldı
          splashBackgroundColor: "#000000", // Siyah Arka Plan
        },
      },
    }),
  },
};
