"use client";

import dynamic from "next/dynamic";

// This is a Client Component, so ssr: false is allowed here
const MainApp = dynamic(() => import("./MainApp"), { ssr: false });

export default function ClientWrapper() {
  return <MainApp />;
}