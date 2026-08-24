"use client";

import { useSession } from "next-auth/react";

export default function MainApp() {
  const { data: session } = useSession();
  
  return (
    <div className="min-h-screen bg-green-600 p-8">
      <h1 className="text-white text-3xl">Pickleball App</h1>
      <p className="text-green-100">
        {session ? `Logged in as: ${session.user?.name}` : "Not logged in"}
      </p>
    </div>
  );
}