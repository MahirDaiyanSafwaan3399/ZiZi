"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { firebaseAuth } from "@/lib/firebase";

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: User };

export function useAuthState(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return useMemo(() => {
    if (loading) return { status: "loading" };
    if (!user) return { status: "signedOut" };
    return { status: "signedIn", user };
  }, [loading, user]);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(firebaseAuth, provider);
  } catch (err) {
    // Popups can be blocked on mobile; redirect is the reliable fallback.
    await signInWithRedirect(firebaseAuth, provider);
  }
}

export async function logOut() {
  await signOut(firebaseAuth);
}

