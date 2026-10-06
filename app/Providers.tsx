"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";
import { ThemeProvider } from './ThemeProvider'
//import { ThemeProvider } from '@/app/ThemeProvider'


export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return <div className="min-h-screen bg-bg flex items-center justify-center"><p className="text-text">Loading...</p></div>;
  }
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}

