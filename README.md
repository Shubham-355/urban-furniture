# Urban Furniture Accounting System

A double-entry accounting web application for a furniture business: master data, purchase and
sales documents, an automatic journal engine, analytical budgets, financial reports and a
self-service portal for contacts.

Every confirmed document posts a balanced journal entry, and every report is derived from those
posted entries — nothing in the reports is stored twice or maintained by hand.

---

## Stack

| Layer | Choice |
|---|---|
| Backend | Node.js, Express, TypeScript |
| ORM / DB | Prisma ORM with PostgreSQL |
| Frontend | React + Vite + TypeScript, React Router, Axios, Tailwind CSS |
| Auth | JWT (httpOnly cookie **and** `Authorization: Bearer`), bcrypt hashes |
| Validation | Zod on the server, mirrored on the client |
| Charts | Recharts (pie chart on the Budget Report) |
| PDF | `pdfkit`, rendered server-side for invoices, bills and all three reports |
| Email | Nodemailer over SMTP from `.env` |
| Money | `Decimal(14,2)` in Postgres; integer paise arithmetic in code — never floating point |

Currency is INR, displayed with Indian digit grouping: `Rs. 1,00,000.00`.

```
/backend      Express API, Prisma schema, seed, unit tests
/frontend     React client
docker-compose.yml, .env.example, README.md
```

---

## Setup

### 1. Start PostgreSQL

```bash
docker compose up -d
```

Brings up Postgres 16 on `localhost:5432` (`urban` / `urban` / `urbanfurniture`). If you already
run Postgres, skip this and point `DATABASE_URL` at your own instance.

### 2. Environment

```bash
cp .env.example .env
cp .env.example backend/.env
```

The defaults work against the compose database. Fill in `SMTP_USER` / `SMTP_PASS` (Ethereal or
Mailtrap) if you want the **Send** buttons to deliver real mail — see [Email](#email) below.

### 3. Install, migrate, seed

```bash
npm install                 # root (concurrently, for the combined dev script)
npm run install:all         # backend + frontend dependencies
npm run db:migrate          # creates the schema
npm run db:seed             # master data + a worked demo flow
```

### 4. Run

```bash
npm run dev                 # API on :4000, client on :5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` and `/uploads` to the API, so
there is nothing else to configure.

Other scripts: `npm run build` (both apps), `npm test` (backend unit tests).

### Seeded logins

| Role | Login Id | Password |
|---|---|---|
| Admin (Business Owner) | `admin1` | `Admin@123` |
| Accountant (Invoicing User) | `acct01` | `Acct@1234` |
| Contact (portal) | `nimesh01` | `Nimesh@123` |

---

## Roles

| Role | Rights |
|---|---|
| `ADMIN` | Everything: create and modify all master data, **archive** it, record all transactions, view all reports, create users of any role. |
| `ACCOUNTANT` | Create master data, manage customers and vendors, record every transaction, create journal entries, view reports. Cannot archive master data and cannot create users. |
| `CONTACT` | Linked to exactly one contact. Sees only their own invoices and bills with paid/unpaid status, downloads their PDFs and pays their dues. Nothing else. |

Enforced twice: `requireRole` middleware on every API route, and route guards in the client.
Portal queries are additionally scoped to the signed-in user's own `contactId`.

Public **Sign Up** always creates an `ACCOUNTANT`. Portal logins are created either from the
Contact form ("Create portal user") or from Create User with the role `User`.

### Credential rules

1. Login Id is unique and 6–12 characters.
2. Email must not already exist.
3. Password is longer than 8 characters and contains at least one lowercase letter, one uppercase
   letter and one special character; Password and Re-Enter Password must match.

A failed sign-in always answers `Invalid Login Id or Password`, whichever half was wrong.

---

## The accounting engine

Document numbers are auto-generated sequences and never editable: `P00001`, `S00001`,
`Bill/2026/0001`, `INV/2026/0001`, `PAY/2026/0001`, `JE/2026/0001`. The year comes from the
document date.

| Action | Journal entry |
|---|---|
| Confirm a purchase order | *(none — by design)* |
| Confirm a vendor bill | **Dr** the account on each line (Purchase Expense A/c by default) · **Cr** Creditors A/c |
| Pay a bill | **Dr** Creditors A/c · **Cr** Bank A/c or Cash A/c |
| Confirm a sales order | *(none)* |
| Confirm a customer invoice | **Dr** Debtors A/c · **Cr** Sales Income A/c (per line) · **Cr** Tax Payable A/c when a line carries tax |
| Receive a payment | **Dr** Bank A/c or Cash A/c · **Cr** Debtors A/c |

Every posting runs inside a Prisma `$transaction`, so a document can never end up confirmed
without its entry — or the other way round. A manual entry cannot be posted while debit and
credit differ; the form shows a blocking banner and disables **Post**.

Confirmed documents are immutable. **Reset to Draft** cancels the generated entry (it stays in
the history, marked Cancelled, and is excluded from every report) and reopens the document.

### Pre-configured on seed

**Chart of Accounts** — Bank A/c (Bank), Cash A/c (Cash), Debtors A/c (Asset), Creditors A/c
(Liability), Tax Payable A/c (Liability), Sales Income A/c (Income), Purchase Expense A/c
(Expense), Other Expense A/c (Other Expense), Capital A/c (Capital).

**Journals** — Sales → Sales Income A/c, Purchase → Purchase Expense A/c, Bank → Bank A/c,
Cash → Cash A/c.

Plus demo contacts, products, analytic accounts, two confirmed budgets, an opening capital
entry, and a complete PO → Bill → Payment and SO → Invoice → Receipt flow so the reports are not
empty on a first run.

---

## Budgets

Stages: **Draft → Confirm → Revised → Cancelled**.

- **Confirm** moves a draft budget to Confirmed and reveals the achieved columns.
- **Revise** (Confirmed only) copies the budget into a new draft named `<name> Revised`, sets
  *Revision Of* on the copy and *Revised With* on the original, and moves the original to
  Revised. Both links are clickable.
- **Cancel / Archived** moves the budget to Cancelled.

For each line:

- **Achieved Amount** — Income analytics are achieved by confirmed customer invoice lines,
  Expense analytics by confirmed vendor bill lines, in both cases dated inside the budget period.
  The cell is a button: it opens the list of documents behind the figure.
- **Achieved %** = `Achieved ÷ Committed × 100`
- **Amount To Achieve** = `Committed − Achieved`

Analytics on sales documents must be Income accounts, and on purchase documents Expense
accounts — the pickers filter accordingly and the server rejects a mismatch.

---

## Reports

All three take a period (defaulting to the current 1 April – 31 March financial year), print to
a server-rendered PDF, and read only **posted** journal entries.

- **Profit and Loss** — Income (credits − debits of Income accounts), Purchase Expense and Other
  Expense (debits − credits), and Net Income.
- **Balance Sheet** — Assets (Bank, Cash, Asset) against Liabilities and Capital, where Capital
  includes retained earnings. Total Assets always equals Total Liabilities and Capital; the API
  asserts this and the page shows a warning banner if it ever differs.
- **Budget Report** — list ⇄ kanban, with an achieved-vs-balance pie per budget.

---

## Testing

```bash
npm test
```

37 unit tests over the pure accounting core: journal generation for bills, invoices and
payments, the debit/credit balance check, paise-exact line and document totals, INR formatting,
budget achievement (period and type filtering, percentages, over-achievement), the P&L worked
example from the spec, and the mandatory Balance Sheet equality test — asserted on the spec
example, across a full purchase-and-sales cycle, and on an empty ledger.

---

## Email

Both **Send** buttons attach the server-rendered PDF. Without `SMTP_USER` / `SMTP_PASS` the
message is logged instead of sent and the UI says so plainly rather than reporting a false
success. Forgot Password behaves the same way: with SMTP configured it emails a time-limited
reset link, and without it the link is returned to the page so the flow stays usable in a fresh
checkout.

---

## Walkthrough

1. **Master data** — sign in as `admin1`. Account ▸ Contact: *Azure Furniture* (Vendor) and
   *Nimesh Pathak* (Customer) are seeded; add your own with **New**. Account ▸ Product holds
   *Wooden Chair* and friends — the Category dropdown creates a category on the fly. Chart of
   Account and Journals are pre-configured. Account ▸ Analyticals has *Furniture* (Expense);
   Account ▸ Analytical Budget has *Furniture Jan 2026*, confirmed, committed 2,00,000.
2. **A purchase** — Purchase ▸ Purchase Order ▸ New: Azure Furniture, Wooden Chair × 3 @ 2,000,
   analytic *Furniture* → **Confirm** → **Create Bill** → **Confirm**. The Journal Entry smart
   button shows Dr Purchase Expense 6,000 / Cr Creditors 6,000. **Pay** via Bank → Dr Creditors /
   Cr Bank, the bill turns Paid and Amount Due is 0. Open the budget: Achieved 6,000, 3%, Amount
   To Achieve 1,94,000.
3. **A sale** — Sales ▸ Sales Order ▸ New: Nimesh Pathak, Office Chair × 5 → **Confirm** →
   **Create Invoice** → **Confirm** (Dr Debtors / Cr Sales Income) → **Pay** via Cash
   (Dr Cash / Cr Debtors).
4. **Reports** — Profit and Loss, Balancesheet (totals equal) and Budget Report with its pie.
   **Print** downloads a PDF from each.
5. **Portal** — sign in as `nimesh01` to see only Nimesh's own invoices with paid/unpaid status,
   download a PDF and pay an open one.
6. **Revise a budget** — on the confirmed budget click **Revise**: a new
   *Furniture Jan 2026 Revised* draft appears with a *Revision Of* link, and the original moves
   to Revised with a *Revised With* link back.

---

## Decisions where the spec was silent

- **Journal entry numbering.** The spec shows `JE/2026/0001` as the sequence but lists
  `Bill/2026/0001` as an entry number. System-generated entries therefore carry the number of the
  document that produced them, and manual entries take the `JE/…` sequence — both examples hold.
- **Retained earnings.** The balance sheet is cumulative to the end of the period rather than
  period-only, so Assets = Liabilities + Capital holds exactly rather than approximately.
- **Budget achievement uses untaxed line amounts**, so an income budget lines up with the Sales
  Income total on the P&L instead of being inflated by tax.
- **Achieved documents count from Confirmed onwards**, and keep counting once a document is
  fully Paid.
- **Cancelling** a bill or invoice is blocked once payments exist against it; reverse the
  payments first.
- The Sign Up screen's button reads **SIGN UP**. The mockup labels it "SIGN OUT", which is
  plainly a slip on a registration form.
