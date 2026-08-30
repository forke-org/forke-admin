<p align="center">
  <img src="./public/forke-assets/email-banners/main-banner.png" width="100%" alt="Forke Banner" />
</p>

# 🛡️ Forke Admin Console

<p align="center">
  <i>The command center for Forke operations — user moderation, escrow settlement, dispute arbitration, and real-time security telemetry.</i>
</p>

<p align="center">
  <a href="https://www.forke.space/?source=github"><strong>Official Website</strong></a> ·
  <a href="https://github.com/forke-org/.github"><strong>Org Profile</strong></a> ·
  <a href="https://github.com/forke-org/forke-marketing"><strong>Marketing Repo</strong></a> ·
  <a href="https://github.com/forke-org/forke-dashboard"><strong>Dashboard Repo</strong></a> ·
  <a href="https://github.com/forke-org/forke-backend"><strong>Backend Repo</strong></a>
</p>

---

## 📖 Overview

`forke-admin` is the internal administration portal for **Forke**. It gives platform administrators and moderators complete visibility and control over users, task postings, dispute claims, escrow transactions, and security audits.

### ✨ Key Features
* 🛡️ **Role-Based Access Control:** Strict admin-tier session verification and security enforcement.
* ⚖️ **Dispute Arbitration:** Full audit trail viewer for disputed tasks, code diff comparisons, and manual escrow release/refund controls.
* 👥 **User & Org Management:** User search, suspension/ban triggers, XP adjustment, and verified status toggles.
* 📊 **Platform Health & Metrics:** Real-time visibility into active escrow volume, daily active builders, and payout throughput.
* 🔍 **Security & Event Logs:** Anonymized IP security logs (`auth_events`), suspicious login alerts, and backup webhook monitoring.

---

## 🛠️ Tech Stack

* **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Turbopack, React 19)
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
* **Database & ORM:** PostgreSQL, [Drizzle ORM](https://orm.drizzle.team/)
* **Authentication:** NextAuth / [Auth.js v5](https://authjs.dev/) (Admin Role Protection)
* **Storage:** Cloudflare R2 (S3-compatible)
* **Icons & UI:** Lucide React, Remix Icons, TipTap

---

## 🚀 Getting Started Locally

### Prerequisites
* **Node.js:** `v20.x` or `v22.x`+
* **Package Manager:** `npm`, `pnpm`, or `bun`
* **PostgreSQL:** Local PostgreSQL instance or Docker container

### 1. Clone the repository
```bash
git clone https://github.com/forke-org/forke-admin.git
cd forke-admin
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env.local` file by copying the sample:
```bash
cp .env.example .env.local
```

Configure your `.env.local` for local execution:
```env
# Database Connection
DATABASE_URL="postgresql://forke:forke_secret@localhost:5433/forke_dev"

# Auth.js / NextAuth
AUTH_SECRET="your_generated_secret_here" # generate with: npx auth secret
AUTH_TRUST_HOST="true"
AUTH_URL="http://localhost:3002"

# Cross-Service Subdomain Navigation
NEXT_PUBLIC_APP_URL="http://localhost:3002"
NEXT_PUBLIC_MARKETING_URL="http://localhost:3000"
NEXT_PUBLIC_DASHBOARD_URL="http://localhost:3001"
NEXT_PUBLIC_ADMIN_URL="http://localhost:3002"
NEXT_PUBLIC_API_URL="http://localhost:8080/api/v1"

# Security Salts & Encryption
ANALYTICS_IP_SALT="local_dev_salt_string"
FILE_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
BACKUP_WEBHOOK_SECRET="local_dev_backup_secret"
```

### 4. Run the development server
```bash
npm run dev
```

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js dev server |
| `npm run build` | Builds the production admin console with memory optimizations |
| `npm run start` | Runs the production build |
| `npm run lint` | Runs ESLint to check for code quality and type safety |

---

## 📂 Project Structure

```
forke-admin/
├── app/              # Admin routes (users, disputes, escrow, audit-logs, analytics)
├── components/       # Admin UI tables, stats cards, dispute modals, charts
├── constants/        # Admin navigation routes, action types, role permissions
├── lib/              # Drizzle DB queries, auth middleware, helper utilities
├── public/           # Static branding assets and images
├── types/            # Admin types and database schema definitions
└── ...
```

---

## 🍊 Meet Forky!

<p align="center">
  <img src="./public/forke-assets/forky-reactions/locked_in_forky.png" width="160" alt="Locked In Forky" /> &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="./public/forke-assets/forky-reactions/grind_mode_forky.png" width="160" alt="Grind Mode Forky" /> &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="./public/forke-assets/forky-reactions/loot_goblin_forky.png" width="160" alt="Loot Goblin Forky" /> &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="./public/forke-assets/forky-reactions/confused_forky.png" width="160" alt="Confused Forky" />
</p>

---

## 📄 License

This repository is **source-available, not open-source**. The code is public for
transparency and reference, but **all rights are reserved** — you may read and fork
it on GitHub, but you may **not** use, deploy, copy, or commercialize it without
prior written permission. See [LICENSE](./LICENSE) for the full terms.
