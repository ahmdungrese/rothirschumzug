import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Anybody } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const anybody = Anybody({
  variable: "--font-anybody",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

import { Toaster } from 'react-hot-toast';
import { Providers } from "@/components/Providers";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { NetworkMonitor } from "@/components/NetworkMonitor";

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
      className={`${plusJakartaSans.variable} ${anybody.variable} h-full antialiased light light-mode`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#D91E2A" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="h-full flex flex-col bg-slate-50 dark:bg-bg-dark text-slate-900 dark:text-text-main">
        <NetworkMonitor />
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
