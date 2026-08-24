"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return <div className="min-h-screen bg-green-600 flex items-center justify-center"><p className="text-white">Loading...</p></div>;
  }
  
  return <SessionProvider>{children}</SessionProvider>;
}