import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Toaster } from 'react-hot-toast';
import { Providers } from "@/components/Providers";
import { PwaRegister } from "@/components/pwa/PwaRegister";

export const metadata: Metadata = {
  title: "Rothirsch Umzüge",
  description: "Internes System für Umzugslogistik",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rothirsch",
  },
  icons: {
    icon: "/2.png",
    apple: "/2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#f97316" />
      </head>
      <body className="h-full flex flex-col bg-bg-dark text-text-main">
        <PwaRegister />
        <Providers>{children}</Providers>
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#2A2A2A',
              color: '#fff',
              border: '1px solid #404040',
              borderRadius: '8px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
