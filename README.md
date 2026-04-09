<div align="center">
  <h1 align="center">ZIZI. TRACKER</h1>
  <p align="center">
    <strong>Simple. Brutal. Fast.</strong>
  </p>
  <p align="center">
    A hyper-performant, 100vh viewport-locked personal expense tracker engineered entirely with Next.js and Firebase. Designed with an uncompromising "SaaS Brutalism" aesthetic.
  </p>
</div>

<hr />

## 🏴‍☠️ Philosophy
Zizi is built to do one thing perfectly: lock down your financial tracking with zero fluff, zero lag, and an interface that demands your attention. 

Eschewing heavy CSS frameworks like Tailwind, this application relies entirely on **pure, structural Vanilla CSS**. It embraces thick architecture, stark black boundaries, high-contrast custom variables, and geometric precision to deliver a premium, "highest-paid-designer" feel while optimizing raw performance. 

## ✨ Key Features
- 🧱 **SaaS Brutalism Aesthetics:** Thick borders, deep `#0a0a0a` blacks, solid typography, and high-contrast dynamic accent colors.
- 📱 **Mobile-Obsessed UX:** Swaps the traditional desktop grid out for a massive, thumb-optimized tab router lock. Every action button is scaled specifically for single-handed mobile navigation.
- 🎨 **Dynamic User Modes:** Users can completely decouple from hardcoded platforms (e.g., EBL / bKash) and generate unlimited custom tracking modes, complete with custom hex color brand integration.
- 🪢 **Nested Expense Splitting:** An accordion-based "messenger thread" breakdown system directly inside ledger items. Withdraw 500 cash? Open the threaded drop-zone and document the exact granular sub-spending natively below it.
- 🛡️ **Iron-Clad Validation:** Client-side keystroke interceptors paired directly with heavily locked-down Firebase Security Rules. It is physically impossible to submit malformed or negative data.

## 🛠️ Technology Stack
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Pure Vanilla CSS
- **Database:** Firebase Firestore (NoSQL Document Store)
- **Authentication:** Firebase Auth (Google OAuth Provider)

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/MahirDaiyanSafwaan3399/ZiZi.git
cd zizi
npm install
```

### 2. Configure Environment Variables
Create a local `.env.local` file at the root of the project with your Firebase client keys.
*(Ensure your Firebase project has Authentication and Firestore enabled).*

```env
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
```

### 3. Deploy Firestore Security Rules
For the application to function, you **must** instruct your live Firebase instance to authorize custom User Settings and nested Expense Arrays. Copy the local `firestore.rules` contents and paste them directly into your Firebase Console Rules editor, then hit **Publish**.

### 4. Run the Local Engine
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

*(Note: The Next.js `next.config.ts` dynamically sets `Cross-Origin-Opener-Policy: same-origin-allow-popups` globally. This ensures the app is immune to modern Chrome COOP deadlocks during the Firebase OAuth flow).*

---
<div align="center">
  <i>Engineered by <strong>Mahir Daiyan Safwaan</strong></i>
</div>
