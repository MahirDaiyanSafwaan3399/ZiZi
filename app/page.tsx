"use client";

import { useMemo, useState, useEffect, useRef } from "react";
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

export function triggerToast(message: string, type: "success" | "roast" | "error" = "success") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent('zizi-toast', { detail: { message, type } }));
  }
}

function ToastContainer() {
  const [toasts, setToasts] = useState<{ id: number, message: string, type: string }[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, ...customEvent.detail }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };
    window.addEventListener('zizi-toast', handleToast);
    return () => window.removeEventListener('zizi-toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`neo-toast ${t.type}`}>
          <span style={{ fontSize: '20px', marginRight: '10px' }}>
            {t.type === 'roast' ? '💀' : t.type === 'error' ? '🚫' : '✓'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
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

      <ToastContainer />
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
      <h1 className="splash-title">Track<br />Your<br />Cash.</h1>
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

  const [mobileTab, setMobileTab] = useState<"ledger" | "add" | "sources">("ledger");

  const totalBySource = useMemo(() => {
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
        <button className={`tab-btn ${mobileTab === "sources" ? "active" : ""}`} onClick={() => setMobileTab("sources")}>SOURCES</button>
      </div>

      <div className={`sidebar ${mobileTab === "ledger" ? "hide-on-mobile" : ""}`}>
        {mobileTab !== "sources" && (
          <>
            <AddExpenseCard uid={uid} modes={modes} onAdded={() => setMobileTab("ledger")} />

            <div className="stats-grid">
              {modes.map(m => (
                <div key={m.id} className="stat-box" style={{ background: m.color, color: 'var(--text-main)' }}>
                  <div className="stat-label">{m.name.toUpperCase()} TOTAL</div>
                  <div className="stat-value">{fmtMoney(totalBySource[m.id] || 0)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {mobileTab === "sources" && (
          <SourcesManager uid={uid} settings={settings} />
        )}

        {/* Desktop explicitly shows settings if they aren't on mobile view */}
        <div className="desktop-modes-wrapper hide-on-mobile" style={{ marginTop: "24px" }}>
          {mobileTab !== "sources" && <SourcesManager uid={uid} settings={settings} />}
        </div>
      </div>

      <div className={`main-content ${mobileTab === "add" || mobileTab === "sources" ? "hide-on-mobile" : ""}`}>
        <div className="neo-card ledger-card">
          <h2 className="card-title">DAILY EXPENSE</h2>

          {loading && <div style={{ fontWeight: 900, fontSize: "24px" }}>SYNCING DATA...</div>}
          {error && <div style={{ color: "red", fontWeight: 900 }}>{error.message}</div>}

          {!loading && !error && groups.length === 0 && (
            <div style={{ fontWeight: 900, fontSize: "24px" }}>NO EXPENSES FOUND. TIME TO SPEND?</div>
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

function SourcesManager({ uid, settings }: { uid: string, settings: UserSettings }) {
  const presetColors = [
    "#4f46e5", "#dca318", "#f34b7d", "#ea580c",
    "#16a34a", "#0bc99d", "#9333ea", "#0a0a0a",
    "#3b82f6", "#eab308"
  ];

  const [name, setName] = useState("");
  const [color, setColor] = useState(presetColors[0]);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const trimmedName = name.trim();
      let newModes = [...settings.modes];

      if (editId) {
        newModes = newModes.map(m => m.id === editId ? { ...m, name: trimmedName, color } : m);
      } else {
        const id = trimmedName.toUpperCase();
        if (newModes.some(m => m.id === id)) {
          alert("Source already exists.");
          setBusy(false);
          return;
        }
        newModes.push({ id, name: trimmedName, color });
      }

      await saveUserSettings(uid, { modes: newModes });
      setName("");
      setEditId(null);
      setColor(presetColors[0]);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(modeId: string) {
    if (settings.modes.length <= 1) {
      alert("You must have at least one source.");
      return;
    }
    setBusy(true);
    try {
      const newModes = settings.modes.filter(m => m.id !== modeId);
      await saveUserSettings(uid, { modes: newModes });
      if (editId === modeId) {
        cancelEdit();
      }
    } finally {
      setBusy(false);
    }
  }

  function startEdit(m: SpendModeDef) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setEditId(m.id);
    setName(m.name);
    setColor(m.color);
  }

  function cancelEdit() {
    setEditId(null);
    setName("");
    setColor(presetColors[0]);
  }

  return (
    <div className="neo-card highlight" style={{ background: '#fff' }}>
      <h2 className="card-title">MANAGE SOURCES</h2>
      <div className="compact-form-grid" style={{ marginBottom: "20px" }}>
        <div className="neo-input-group">
          <label>Source Name</label>
          <input className="neo-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CARD" />
        </div>
        <div className="neo-input-group">
          <label>Brand Color</label>
          <div className="color-picker-wrapper">
            {presetColors.map(c => (
              <button
                key={c}
                className={`color-preset ${color === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                type="button"
                aria-label={`Select color ${c}`}
              />
            ))}
            <div className={`custom-color-wrapper ${!presetColors.includes(color) ? 'active' : ''}`}>
              <input
                type="color"
                className="custom-color-input"
                value={color}
                onChange={e => setColor(e.target.value)}
                title="Custom Color"
              />
            </div>
          </div>
        </div>
        {editId ? (
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button className="neo-btn full" style={{ marginTop: 0, flex: 2 }} onClick={() => void onSubmit()} disabled={!canSubmit}>{busy ? "..." : "SAVE"}</button>
            <button className="neo-btn full" style={{ marginTop: 0, flex: 1, background: 'var(--text-main)' }} onClick={cancelEdit} disabled={busy}>CANCEL</button>
          </div>
        ) : (
          <button className="neo-btn full" onClick={() => void onSubmit()} disabled={!canSubmit}>{busy ? "..." : "ADD SOURCE"}</button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {settings.modes.map(m => (
          <div key={m.id} style={{ display: 'flex', border: '3px solid black', padding: '12px', background: m.color, justifyContent: 'space-between', alignItems: 'center', boxShadow: '4px 4px 0px 0px var(--border-color)' }}>
            <span style={{ fontWeight: 900, color: '#0a0a0a', fontSize: '16px' }}>{m.name.toUpperCase()}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="action-btn small" onClick={() => startEdit(m)} disabled={busy} style={{ boxShadow: 'none', background: '#fff', color: 'var(--text-main)' }}>EDIT</button>
              <button className="action-btn del small" onClick={() => void onDelete(m.id)} disabled={busy} style={{ boxShadow: 'none', background: 'var(--text-main)', color: '#fff' }}>DEL</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getSavageRoast(amount: number, title: string) {
  if (!amount || amount <= 0) return "READY TO MAKE BAD DECISIONS?";
  if (amount < 10) return "WOW, A WHOLE " + amount + ". DON'T GO BANKRUPT.";
  if (amount < 50) return "COULD HAVE SAVED THAT. JUST SAYING.";
  if (amount < 100) return title ? `DO YOU REALLY NEED "${title.toUpperCase()}"? NO.` : "DO YOU ENJOY BEING POOR?";
  if (amount < 500) return "FINANCIAL FREEDOM JUST SWIPED LEFT ON YOU.";
  if (amount < 1000) return "YOUR ANCESTORS SURVIVED ON GRASS SO YOU COULD BUY THIS??";
  return "CONGRATULATIONS ON FUNDING SOMEONE ELSE'S YACHT.";
}

function getButtonText(amount: number, busy: boolean) {
  if (busy) return "FLUSHING MONEY...";
  if (!amount || amount <= 0) return "SAVE EXPENSE";
  if (amount < 50) return "LOSE MONEY";
  if (amount < 100) return "FINANCIAL RUIN";
  if (amount < 500) return "IRRESPONSIBLE PURCHASE";
  return "DESTROY MY FUTURE";
}

function AddExpenseCard({ uid, modes, onAdded }: { uid: string; modes: SpendModeDef[]; onAdded?: () => void }) {
  const [date, setDate] = useState(todayLocalIsoDate());
  const [mode, setMode] = useState<SpendMode>(modes[0]?.id || "");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const parsedAmount = Number(amount);

  const roast = useMemo(() => getSavageRoast(parsedAmount, title), [parsedAmount, title]);
  const btnText = useMemo(() => getButtonText(parsedAmount, busy), [parsedAmount, busy]);

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
          <label>Source</label>
          <SourceSelect modes={modes} value={mode} onChange={(v) => setMode(v as SpendMode)} />
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

      <div style={{
        marginTop: "16px",
        marginBottom: "16px",
        padding: "12px",
        background: parsedAmount > 500 ? "var(--accent-bkash)" : "var(--accent-neutral)",
        border: "3px solid black",
        fontWeight: 900,
        textTransform: "uppercase",
        boxShadow: "4px 4px 0px 0px var(--border-color)",
        color: parsedAmount > 500 ? "#fff" : "var(--text-main)",
        animation: parsedAmount > 99 ? "savageShake 0.4s ease-in-out infinite alternate" : "none"
      }}>
        🚨 {roast}
      </div>

      <button className="neo-btn full" onClick={() => void onSubmit()} disabled={!canSubmit}>{btnText}</button>
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
      triggerToast("EDIT SAVED. YOU'RE STILL BROKE THOUGH.", "success");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteExpense(uid, it.id);
      triggerToast("DELETED. GONE FOREVER (LIKE YOUR SAVINGS).", "roast");
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
      <div className="expense-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <div className="edit-form-grid">
          <input className="neo-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <SourceSelect modes={modes} value={mode} onChange={(v) => setMode(v as SpendMode)} />
          <input className="neo-input" type="number" min="0" value={amount} onChange={(e) => setAmount(sanitizeNumberInput(e.target.value))} placeholder="Amount" />
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
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
          <button className="action-btn del" onClick={() => setShowDeleteModal(true)} disabled={busy}>DEL</button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="card-title">DELETE THIS?</h2>
            <p className="modal-text">
              ARE YOU SURE YOU WANT TO DELETE <span className="highlight-text">{it.title}</span>? THERE IS NO COMING BACK FROM THIS.
            </p>
            <div className="modal-actions">
              <button
                className="neo-btn danger-btn"
                onClick={() => { setShowDeleteModal(false); void onDelete(); }}
                disabled={busy}
              >
                YES, TRASH IT
              </button>
              <button
                className="neo-btn cancel-btn"
                onClick={() => setShowDeleteModal(false)}
                disabled={busy}
              >
                NEVERMIND
              </button>
            </div>
          </div>
        </div>
      )}

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

function SourceSelect({ value, onChange, modes, className = "" }: { value: string, onChange: (val: string) => void, modes: SpendModeDef[], className?: string }) {
  const [open, setOpen] = useState(false);
  const selectedDef = modes.find(m => m.id === value) || modes[0];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className={`custom-select-wrapper ${className}`} style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        className="neo-input custom-select-btn"
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', background: '#fff' }}
      >
        {selectedDef ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="color-dot" style={{ background: selectedDef.color, width: '16px', height: '16px', borderRadius: '50%', display: 'inline-block', border: '3px solid black', boxShadow: '2px 2px 0px 0px var(--border-color)' }} />
            {selectedDef.name.toUpperCase()}
          </span>
        ) : "SELECT SOURCE"}
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: '14px', fontWeight: 900 }}>▼</span>
      </button>

      {open && (
        <div className="custom-select-dropdown" style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#fff', border: '3px solid var(--border-color)',
          boxShadow: '6px 6px 0px 0px var(--border-color)',
          marginTop: '8px', zIndex: 50, display: 'flex', flexDirection: 'column',
          maxHeight: '260px', overflowY: 'auto'
        }}>
          {modes.map(m => (
            <div
              key={m.id}
              className="custom-select-option"
              onClick={() => { onChange(m.id); setOpen(false); }}
              style={{
                padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                borderBottom: '3px solid var(--border-color)',
                background: value === m.id ? 'var(--accent-neutral)' : 'transparent',
                fontWeight: 900,
                fontSize: '16px'
              }}
            >
              <span className="color-dot" style={{ background: m.color, width: '16px', height: '16px', borderRadius: '50%', display: 'inline-block', border: '3px solid black', boxShadow: '2px 2px 0px 0px var(--border-color)' }} />
              <span style={{ flex: 1, textTransform: 'uppercase' }}>{m.name}</span>
              {value === m.id && <span style={{ fontSize: '18px' }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
