"use client";

import { signIn, signOut } from "next-auth/react";
import { Session } from "next-auth";

interface AuthHeaderProps {
  session: Session | null;
}

export function AuthHeader({ session }: AuthHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      {!session && (
        <span className="flex items-center gap-1.5 text-xs text-subtext">
          <span>{"🔒"}</span>
          <span>Sign in to save your players & history</span>
        </span>
      )}
      {session ? (
        <>
          <span className="text-xs text-text">
            Signed in as {session.user?.name}
          </span>
          <button
            onClick={() => signOut()}
            className="bg-muted-bg text-text px-3 py-1 rounded-md text-xs font-medium hover:bg-hover-bg transition-colors"
          >
            Sign Out
          </button>
        </>
      ) : (
        <button
          onClick={() => signIn("google")}
          className="bg-muted-bg text-text px-3 py-1 rounded-md text-xs font-medium hover:bg-hover-bg transition-colors"
        >
          Sign In with Google
        </button>
      )}
    </div>
  );
}