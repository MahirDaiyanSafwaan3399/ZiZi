"use client";

import { useMemo, useState } from "react";
import { logOut, signInWithGoogle, useAuthState } from "@/lib/auth";
import {
  addExpense,
  deleteExpense,
  updateExpense,
  useExpenses,
  type Expense,
  type ExpenseSubItem,
  type SpendMode,
} from "@/lib/expenses";

function todayLocalIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function groupByDate(items: Expense[]) {
  const m = new Map<string, Expense[]>();
  for (const it of items) {
    const arr = m.get(it.date) ?? [];
    arr.push(it);
    m.set(it.date, arr);
  }
  return [...m.entries()].map(([date, list]) => ({
    date,
    list,
    total: list.reduce((s, x) => s + x.amount, 0),
    byMode: list.reduce(
      (acc, x) => {
        acc[x.mode] += x.amount;
        return acc;
      },
      { EBL: 0, bKash: 0 } as Record<SpendMode, number>,
    ),
  }));
}

export default function Home() {
  const auth = useAuthState();

  return (
    <div className="layout-wrapper">
      <Header auth={auth} />
      
      {auth.status === "loading" && <div><h1 className="splash-title">LOADING...</h1></div>}
      {auth.status === "signedOut" && <SignedOut />}
      {auth.status === "signedIn" && <Dashboard uid={auth.user.uid} />}
    </div>
  );
}

function Header({ auth }: { auth: ReturnType<typeof useAuthState> }) {
  return (
    <div className="header">
      <div className="logo">ZIZI.</div>
      
      {auth.status === "signedIn" && (
        <div className="profile-area">
          <div className="profile-info">
            <h1>{auth.user.displayName || "USER"}</h1>
            <div className="profile-tag">@zizi_tracker</div>
          </div>
          <button className="logout-btn" onClick={() => void logOut()} title="Logout">
            LOGOUT
          </button>
        </div>
      )}
    </div>
  );
}

function SignedOut() {
  return (
    <div className="splash-screen">
      <h1 className="splash-title">Track<br/>Your<br/>Cash.</h1>
      <div><p className="splash-subtitle">Simple. Brutal. Fast.</p></div>
      <button className="neo-btn" onClick={() => void signInWithGoogle()}>
        SIGN IN WITH GOOGLE
      </button>
    </div>
  );
}

function Dashboard({ uid }: { uid: string }) {
  const { items, loading, error } = useExpenses(uid);
  const groups = useMemo(() => groupByDate(items), [items]);
  
  const [mobileTab, setMobileTab] = useState<"ledger" | "add">("ledger");
  
  const byMode = useMemo(
    () =>
      items.reduce(
        (acc, x) => {
          acc[x.mode] += x.amount;
          return acc;
        },
        { EBL: 0, bKash: 0 } as Record<SpendMode, number>,
      ),
    [items],
  );

  return (
    <div className="dashboard-grid">
      <div className="mobile-tab-nav">
        <button 
          className={`tab-btn ${mobileTab === "ledger" ? "active" : ""}`}
          onClick={() => setMobileTab("ledger")}
        >
          EXPENSE
        </button>
        <button 
          className={`tab-btn ${mobileTab === "add" ? "active" : ""}`}
          onClick={() => setMobileTab("add")}
        >
          ADD NEW
        </button>
      </div>

      <div className={`sidebar ${mobileTab === "ledger" ? "hide-on-mobile" : ""}`}>
        <AddExpenseCard uid={uid} onAdded={() => setMobileTab("ledger")} />

        <div className="stats-grid">
          <div className="stat-box ebl">
            <div className="stat-label">EBL Total</div>
            <div className="stat-value">{fmtMoney(byMode.EBL)}</div>
          </div>
          <div className="stat-box bkash">
            <div className="stat-label">bKash Total</div>
            <div className="stat-value">{fmtMoney(byMode.bKash)}</div>
          </div>
        </div>
      </div>

      <div className={`main-content ${mobileTab === "add" ? "hide-on-mobile" : ""}`}>
        <div className="neo-card ledger-card">
          <h2 className="card-title">DAILY EXPENSE</h2>
          
          {loading && <div style={{fontWeight: 900, fontSize: "24px"}}>SYNCING DATA...</div>}
          {error && <div style={{color: "red", fontWeight: 900}}>{error.message}</div>}

          {!loading && !error && groups.length === 0 && (
            <div style={{fontWeight: 900, fontSize: "24px"}}>NO EXPENSES FOUND. TIME TO SPEND?</div>
          )}

          <div className="ledger-scroll-area">
            {groups.map((g) => (
              <DayGroup key={g.date} uid={uid} date={g.date} list={g.list} total={g.total} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function sanitizeNumberInput(val: string) {
  // Prevent any negative signs
  if (val.includes("-")) return val.replace(/-/g, "");
  return val;
}

function AddExpenseCard({ uid, onAdded }: { uid: string; onAdded?: () => void }) {
  const [date, setDate] = useState(todayLocalIsoDate());
  const [mode, setMode] = useState<SpendMode>("EBL");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const parsedAmount = Number(amount);

  const canSubmit =
    date.length === 10 &&
    title.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await addExpense(uid, {
        date,
        mode,
        title: title.trim(),
        amount: parsedAmount,
      });
      setTitle("");
      setAmount("");
      if (onAdded) onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="neo-card highlight">
      <h2 className="card-title">NEW EXPENSE</h2>
      
      <div className="compact-form-grid">
        <div className="neo-input-group">
          <label>Date</label>
          <input
            className="neo-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="neo-input-group">
          <label>Mode</label>
          <select
            className="neo-select"
            value={mode}
            onChange={(e) => setMode(e.target.value as SpendMode)}
          >
            <option value="EBL">EBL</option>
            <option value="bKash">bKash</option>
          </select>
        </div>

        <div className="neo-input-group">
          <label>Amount</label>
          <input
            className="neo-input"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 500"
            value={amount}
            onChange={(e) => setAmount(sanitizeNumberInput(e.target.value))}
          />
        </div>

        <div className="neo-input-group">
          <label>Title</label>
          <input
            className="neo-input"
            placeholder="e.g. sandwich"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSubmit();
            }}
          />
        </div>
      </div>

      <button
        className="neo-btn full"
        onClick={() => void onSubmit()}
        disabled={!canSubmit}
      >
        {busy ? "SAVING..." : "SAVE EXPENSE"}
      </button>
    </div>
  );
}

function DayGroup({ uid, date, list, total }: { uid: string; date: string; list: Expense[]; total: number; }) {
  return (
    <div className="expense-group">
      <div className="group-header">
        <div className="group-date">{date}</div>
        <div className="group-total">{fmtMoney(total)}</div>
      </div>
      <div>
        {list.map((it) => (
          <ExpenseRow key={it.id} uid={uid} it={it} />
        ))}
      </div>
    </div>
  );
}

function ExpenseRow({ uid, it }: { uid: string; it: Expense }) {
  const [editing, setEditing] = useState(false);
  const [breakingDown, setBreakingDown] = useState(false);
  
  // Edit State
  const [title, setTitle] = useState(it.title);
  const [amount, setAmount] = useState(String(it.amount));
  const [mode, setMode] = useState<SpendMode>(it.mode);
  
  // Breakdown State
  const [bdTitle, setBdTitle] = useState("");
  const [bdAmount, setBdAmount] = useState("");
  
  const [busy, setBusy] = useState(false);

  const changed = title.trim() !== it.title || Number(amount) !== it.amount || mode !== it.mode;

  const currentBreakdownTotal = (it.subItems || []).reduce((acc, sub) => acc + sub.amount, 0);

  async function onSaveEdit() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    try {
      await updateExpense(uid, it.id, { title: title.trim(), amount: n, mode });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteExpense(uid, it.id);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveBreakdown() {
    const n = Number(bdAmount);
    if (!Number.isFinite(n) || n <= 0 || bdTitle.trim().length === 0) return;
    
    // Validate we don't exceed the parent amount
    if (currentBreakdownTotal + n > it.amount) {
      alert("Breakdown amount exceeds the parent expense total!");
      return;
    }
    
    setBusy(true);
    try {
      const newItem: ExpenseSubItem = { id: Date.now().toString(), title: bdTitle.trim(), amount: n };
      const nextSubs = [...(it.subItems || []), newItem];
      await updateExpense(uid, it.id, { subItems: nextSubs });
      setBdTitle("");
      setBdAmount("");
      setBreakingDown(false);
    } catch (e: any) {
      alert("Breakdown failed to save via Firebase: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteBreakdown(subId: string) {
    setBusy(true);
    try {
      const nextSubs = (it.subItems || []).filter(sub => sub.id !== subId);
      await updateExpense(uid, it.id, { subItems: nextSubs });
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="expense-item" style={{flexDirection: "column", alignItems: "stretch"}}>
         <div className="edit-form-grid">
            <input className="neo-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            <select className="neo-select" value={mode} onChange={(e) => setMode(e.target.value as SpendMode)}>
              <option value="EBL">EBL</option>
              <option value="bKash">bKash</option>
            </select>
            <input className="neo-input" type="number" min="0" value={amount} onChange={(e) => setAmount(sanitizeNumberInput(e.target.value))} placeholder="Amount" />
         </div>
         <div style={{display: "flex", gap: "10px", marginTop: "16px"}}>
            <button className="action-btn" onClick={() => void onSaveEdit()} disabled={busy || !changed}>SAVE</button>
            <button className="action-btn del" onClick={() => { setEditing(false); setTitle(it.title); setAmount(String(it.amount)); setMode(it.mode); }} disabled={busy}>CANCEL</button>
         </div>
      </div>
    );
  }

  return (
    <div className="expense-item-container">
      <div className="expense-item">
        <div className="expense-info">
          <div className="title">{it.title}</div>
          <div className="expense-amount-area">
            <span className={`expense-mode ${it.mode}`}>{it.mode}</span>
            <span className="expense-amount">{fmtMoney(it.amount)}</span>
          </div>
        </div>
        <div className="expense-actions">
          <button className="action-btn breakdown-btn" onClick={() => setBreakingDown(!breakingDown)} disabled={busy} title="Breakdown this Expense">SPLIT</button>
          <button className="action-btn" onClick={() => setEditing(true)} disabled={busy}>EDIT</button>
          <button className="action-btn del" onClick={() => void onDelete()} disabled={busy}>DEL</button>
        </div>
      </div>

      {/* Breakdown UI */}
      {(it.subItems && it.subItems.length > 0 || breakingDown) && (
        <div className="breakdown-container">
          <div className="breakdown-tree-line"></div>
          <div className="breakdown-content">
            
            {/* Existing Sub Items */}
            {it.subItems && it.subItems.map((sub) => (
              <div key={sub.id} className="sub-item">
                <div className="sub-info">
                  <span className="sub-title">{sub.title}</span>
                  <span className="sub-amount">{fmtMoney(sub.amount)}</span>
                </div>
                <button className="action-btn del small" onClick={() => void onDeleteBreakdown(sub.id)} disabled={busy}>✕</button>
              </div>
            ))}

            {/* Breakdown Form */}
            {breakingDown && (
              <div className="sub-item-form">
                 <input className="neo-input small" placeholder="Sub-item" value={bdTitle} onChange={(e) => setBdTitle(e.target.value)} />
                 <input className="neo-input small" type="number" min="0" placeholder="Amt" value={bdAmount} onChange={(e) => setBdAmount(sanitizeNumberInput(e.target.value))} />
                 <button className="action-btn" onClick={() => void onSaveBreakdown()} disabled={busy || !bdTitle || !bdAmount}>ADD</button>
              </div>
            )}
            
            {(it.subItems && it.subItems.length > 0) && (
               <div className="sub-item-summary">Remaining: {fmtMoney(it.amount - currentBreakdownTotal)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
