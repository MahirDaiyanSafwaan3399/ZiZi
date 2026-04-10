"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
  type FirestoreError,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { firestore } from "@/lib/firebase";

export type SpendMode = string;

export type SpendModeDef = {
  id: string;   // The internal machine name
  name: string; // The display name
  color: string; // Hex color code
};

export type UserSettings = {
  modes: SpendModeDef[];
};

export type ExpenseSubItem = {
  id: string;
  title: string;
  amount: number;
  time?: string; // e.g., "04:54 PM"
};

export type Expense = {
  id: string;
  date: string; // yyyy-mm-dd (local)
  amount: number;
  mode: SpendMode;
  title: string;
  createdAtMs?: number;
  subItems?: ExpenseSubItem[];
};

type ExpenseDoc = {
  date: string;
  amount: number;
  mode: SpendMode;
  title: string;
  createdAt: unknown;
  updatedAt?: unknown;
  subItems?: ExpenseSubItem[];
};

function userExpensesCol(uid: string) {
  return collection(firestore, "users", uid, "expenses");
}

export function useExpenses(uid: string) {
  const [items, setItems] = useState<Expense[]>([]);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = query(userExpensesCol(uid), orderBy("date", "desc"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Expense[] = [];
        snap.forEach((d) => {
          const data = d.data() as ExpenseDoc;
          const createdAtMs =
            typeof (data.createdAt as any)?.toMillis === "function"
              ? (data.createdAt as any).toMillis()
              : undefined;
          next.push({
            id: d.id,
            date: data.date,
            amount: data.amount,
            mode: data.mode,
            title: data.title,
            createdAtMs,
            subItems: data.subItems,
          });
        });
        setItems(next);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [uid]);

  return useMemo(() => ({ items, loading, error }), [items, loading, error]);
}

export async function addExpense(uid: string, input: Omit<Expense, "id" | "createdAtMs">) {
  const payload: ExpenseDoc = {
    date: input.date,
    amount: input.amount,
      mode: input.mode,
    title: input.title,
    createdAt: serverTimestamp(),
    ...(input.subItems && { subItems: input.subItems }),
  };
  await addDoc(userExpensesCol(uid), payload);
}

export async function updateExpense(
  uid: string,
  id: string,
  input: Partial<Pick<Expense, "date" | "amount" | "mode" | "title" | "subItems">>,
) {
  const ref = doc(firestore, "users", uid, "expenses", id);
  await updateDoc(ref, { ...input, updatedAt: serverTimestamp() });
}

export async function deleteExpense(uid: string, id: string) {
  const ref = doc(firestore, "users", uid, "expenses", id);
  await deleteDoc(ref);
}

export function useUserSettings(uid: string) {
  const [settings, setSettings] = useState<UserSettings>({
    modes: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(firestore, "users", uid, "settings", "preferences");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists() && snap.data().modes) {
        setSettings(snap.data() as UserSettings);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return { settings, loading };
}

export async function saveUserSettings(uid: string, settings: UserSettings) {
  const ref = doc(firestore, "users", uid, "settings", "preferences");
  await setDoc(ref, settings, { merge: true });
}

