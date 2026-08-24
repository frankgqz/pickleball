"use client";

import { signIn, signOut } from "next-auth/react";
import { Session } from "next-auth";

interface AuthHeaderProps {
  session: Session | null;
}

export function AuthHeader({ session }: AuthHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="text-green-100 text-sm">
        {!session && (
          <span className="flex items-center gap-2">
            <span>🔒</span>
            <span>Sign in to save your player database & session history</span>
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {session ? (
          <>
            <span className="text-white text-sm">
              Signed in as {session.user?.name}
            </span>
            <button 
              onClick={() => signOut()}
              className="bg-white text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"
            >
              Sign Out
            </button>
          </>
        ) : (
          <button 
            onClick={() => signIn("google")}
            className="bg-white text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"
          >
            Sign In with Google
          </button>
        )}
      </div>
    </div>
  );
}