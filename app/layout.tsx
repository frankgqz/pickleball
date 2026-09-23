export const dynamic = 'force-dynamic';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./Providers";  // ADD THIS
//import '@gqz/theme/theme.css'
import "./globals.css";
import Script from 'next/script'


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pickleball Manager",
  description: "Tournament management app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          (function(){
            var m = document.cookie.match(/(?:^|;\s*)gqz-theme=([^;]+)/);
            var saved = m ? decodeURIComponent(m[1]) : null;
            var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            var theme = saved || (sysDark ? 'dark' : 'wood');
            document.documentElement.setAttribute('data-theme', theme);
          })();
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
