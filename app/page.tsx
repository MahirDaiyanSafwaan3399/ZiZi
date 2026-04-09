"use client";

import { useMemo, useState } from "react";
import { logOut, signInWithGoogle, useAuthState } from "@/lib/auth";
import {
  addExpense,
  deleteExpense,
  updateExpense,
  useExpenses,
  useUserSettings,
  saveUserSettings,
  type Expense,
  type ExpenseSubItem,
  type SpendMode,
  type SpendModeDef,
  type UserSettings,
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
        acc[x.mode] = (acc[x.mode] || 0) + x.amount;
        return acc;
      },
      {} as Record<string, number>,
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
  const { settings, loading: settingsLoading } = useUserSettings(uid);
  
  const groups = useMemo(() => groupByDate(items), [items]);
  const modes = settings.modes;
  
  const [mobileTab, setMobileTab] = useState<"ledger" | "add" | "modes">("ledger");
  
  const totalByMode = useMemo(() => {
    return items.reduce((acc, x) => {
      acc[x.mode] = (acc[x.mode] || 0) + x.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [items]);

  if (settingsLoading) return <div><h1 className="splash-title">SYNCING SETTINGS...</h1></div>;

  return (
    <div className="dashboard-grid">
      <div className="mobile-tab-nav">
        <button className={`tab-btn ${mobileTab === "ledger" ? "active" : ""}`} onClick={() => setMobileTab("ledger")}>EXPENSE</button>
        <button className={`tab-btn ${mobileTab === "add" ? "active" : ""}`} onClick={() => setMobileTab("add")}>ADD</button>
        <button className={`tab-btn ${mobileTab === "modes" ? "active" : ""}`} onClick={() => setMobileTab("modes")}>MODES</button>
      </div>

      <div className={`sidebar ${mobileTab === "ledger" ? "hide-on-mobile" : ""}`}>
        {mobileTab !== "modes" && (
           <>
            <AddExpenseCard uid={uid} modes={modes} onAdded={() => setMobileTab("ledger")} />
            
            <div className="stats-grid">
              {modes.map(m => (
                <div key={m.id} className="stat-box" style={{ background: m.color, color: 'var(--text-main)' }}>
                  <div className="stat-label">{m.name.toUpperCase()} TOTAL</div>
                  <div className="stat-value">{fmtMoney(totalByMode[m.id] || 0)}</div>
                </div>
              ))}
            </div>
           </>
        )}

        {mobileTab === "modes" && (
           <ModesManager uid={uid} settings={settings} />
        )}

        {/* Desktop explicitly shows settings if they aren't on mobile view */}
        <div className="desktop-modes-wrapper hide-on-mobile" style={{marginTop: "24px"}}>
           {mobileTab !== "modes" && <ModesManager uid={uid} settings={settings} />}
        </div>
      </div>

      <div className={`main-content ${mobileTab === "add" || mobileTab === "modes" ? "hide-on-mobile" : ""}`}>
        <div className="neo-card ledger-card">
          <h2 className="card-title">DAILY EXPENSE</h2>
          
          {loading && <div style={{fontWeight: 900, fontSize: "24px"}}>SYNCING DATA...</div>}
          {error && <div style={{color: "red", fontWeight: 900}}>{error.message}</div>}

          {!loading && !error && groups.length === 0 && (
            <div style={{fontWeight: 900, fontSize: "24px"}}>NO EXPENSES FOUND. TIME TO SPEND?</div>
          )}

          <div className="ledger-scroll-area">
            {groups.map((g) => (
              <DayGroup key={g.date} uid={uid} date={g.date} list={g.list} total={g.total} modes={modes} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function sanitizeNumberInput(val: string) {
  if (val.includes("-")) return val.replace(/-/g, "");
  return val;
}

function ModesManager({ uid, settings }: { uid: string, settings: UserSettings }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0bc99d");
  const [busy, setBusy] = useState(false);

  const canAdd = name.trim().length > 0 && !busy;

  async function onAdd() {
    if (!canAdd) return;
    setBusy(true);
    try {
      const newModes = [...settings.modes, { id: name.trim().toUpperCase(), name: name.trim(), color }];
      await saveUserSettings(uid, { modes: newModes });
      setName("");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(modeId: string) {
    if (settings.modes.length <= 1) {
      alert("You must have at least one mode.");
      return;
    }
    setBusy(true);
    try {
      const newModes = settings.modes.filter(m => m.id !== modeId);
      await saveUserSettings(uid, { modes: newModes });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="neo-card highlight" style={{background: '#fff'}}>
      <h2 className="card-title">MANAGE MODES</h2>
      <div className="compact-form-grid" style={{marginBottom: "16px"}}>
         <div className="neo-input-group">
            <label>Mode Name</label>
            <input className="neo-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CARD" />
         </div>
         <div className="neo-input-group">
            <label>Brand Color</label>
            <input className="neo-input" type="color" value={color} onChange={e => setColor(e.target.value)} style={{padding: '4px', height: '44px'}} />
         </div>
         <button className="neo-btn full" onClick={() => void onAdd()} disabled={!canAdd}>{busy ? "..." : "ADD MODE"}</button>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
         {settings.modes.map(m => (
            <div key={m.id} style={{display: 'flex', border: '2px solid black', padding: '8px', background: m.color, justifyContent: 'space-between', alignItems: 'center'}}>
               <span style={{fontWeight: 900, color: '#0a0a0a'}}>{m.name.toUpperCase()}</span>
               <button className="action-btn del small" onClick={() => void onDelete(m.id)} disabled={busy} style={{boxShadow: 'none'}}>DEL</button>
            </div>
         ))}
      </div>
    </div>
  );
}

function AddExpenseCard({ uid, modes, onAdded }: { uid: string; modes: SpendModeDef[]; onAdded?: () => void }) {
  const [date, setDate] = useState(todayLocalIsoDate());
  const [mode, setMode] = useState<SpendMode>(modes[0]?.id || "");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const parsedAmount = Number(amount);

  const canSubmit =
    date.length === 10 &&
    title.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    mode.length > 0 &&
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
          <input className="neo-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="neo-input-group">
          <label>Mode</label>
          <select className="neo-select" value={mode} onChange={(e) => setMode(e.target.value as SpendMode)}>
            {modes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div className="neo-input-group">
          <label>Amount</label>
          <input className="neo-input" type="number" min="0" step="1" placeholder="e.g. 500" value={amount} onChange={(e) => setAmount(sanitizeNumberInput(e.target.value))} />
        </div>

        <div className="neo-input-group">
          <label>Title</label>
          <input className="neo-input" placeholder="e.g. sandwich" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void onSubmit(); }} />
        </div>
      </div>

      <button className="neo-btn full" onClick={() => void onSubmit()} disabled={!canSubmit}>{busy ? "SAVING..." : "SAVE EXPENSE"}</button>
    </div>
  );
}

function DayGroup({ uid, date, list, total, modes }: { uid: string; date: string; list: Expense[]; total: number; modes: SpendModeDef[]; }) {
  return (
    <div className="expense-group">
      <div className="group-header">
        <div className="group-date">{date}</div>
        <div className="group-total">{fmtMoney(total)}</div>
      </div>
      <div>
        {list.map((it) => (
          <ExpenseRow key={it.id} uid={uid} it={it} modes={modes} />
        ))}
      </div>
    </div>
  );
}

function ExpenseRow({ uid, it, modes }: { uid: string; it: Expense; modes: SpendModeDef[]; }) {
  const [editing, setEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
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

  const modeDef = modes.find(m => m.id === it.mode) || { id: it.mode, name: it.mode, color: '#e5e5e5' };

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
              {modes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
            <span className="expense-mode" style={{ background: modeDef.color }}>{modeDef.name}</span>
            <span className="expense-amount">{fmtMoney(it.amount)}</span>
          </div>
        </div>
        <div className="expense-actions">
          <button className={`action-btn breakdown-btn ${isExpanded ? 'active' : ''}`} onClick={() => setIsExpanded(!isExpanded)} disabled={busy} title="Toggle Breakdown">SPLIT</button>
          <button className="action-btn" onClick={() => setEditing(true)} disabled={busy}>EDIT</button>
          <button className="action-btn del" onClick={() => void onDelete()} disabled={busy}>DEL</button>
        </div>
      </div>

      {isExpanded && (
        <div className="breakdown-container">
          <div className="breakdown-tree-line"></div>
          <div className="breakdown-content">
            
            {it.subItems && it.subItems.map((sub) => (
              <div key={sub.id} className="sub-item">
                <div className="sub-info">
                  <span className="sub-title">{sub.title}</span>
                  <span className="sub-amount">{fmtMoney(sub.amount)}</span>
                </div>
                <button className="action-btn del small" onClick={() => void onDeleteBreakdown(sub.id)} disabled={busy}>✕</button>
              </div>
            ))}

            <div className="sub-item-form">
               <input className="neo-input small" placeholder="Sub-item" value={bdTitle} onChange={(e) => setBdTitle(e.target.value)} />
               <input className="neo-input small" type="number" min="0" placeholder="Amt" value={bdAmount} onChange={(e) => setBdAmount(sanitizeNumberInput(e.target.value))} />
               <button className="action-btn" onClick={() => void onSaveBreakdown()} disabled={busy || !bdTitle || !bdAmount}>ADD</button>
            </div>
            
            {(it.subItems && it.subItems.length > 0) && (
               <div className="sub-item-summary">Remaining: {fmtMoney(it.amount - currentBreakdownTotal)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
