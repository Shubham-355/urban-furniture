export type Role = 'ADMIN' | 'ACCOUNTANT' | 'CONTACT';
export type ContactType = 'CUSTOMER' | 'VENDOR' | 'BOTH';
export type ProductType = 'GOODS' | 'SERVICE' | 'COMBO';
export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'BANK'
  | 'CAPITAL'
  | 'CASH'
  | 'INCOME'
  | 'EXPENSE'
  | 'OTHER_EXPENSE';
export type JournalType = 'SALES' | 'PURCHASE' | 'BANK' | 'CASH';
export type EntryStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type AnalyticType = 'INCOME' | 'EXPENSE';
export type BudgetStatus = 'DRAFT' | 'CONFIRMED' | 'REVISED' | 'CANCELLED';
export type DocStatus = 'DRAFT' | 'CONFIRMED' | 'BILLED' | 'INVOICED' | 'PAID' | 'CANCELLED';
export type PaymentVia = 'BANK' | 'CASH';
export type PaymentKind = 'SEND' | 'RECEIVE';

export interface AuthUser {
  id: number;
  name: string;
  loginId: string;
  email: string;
  role: Role;
  contactId: number | null;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface Contact {
  id: number;
  name: string;
  type: ContactType;
  email: string;
  mobile: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  imageUrl: string | null;
  isArchived: boolean;
  portalUser?: { id: number; loginId: string; email: string } | null;
}

export interface ProductCategory {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  type: ProductType;
  categoryId: number | null;
  category: ProductCategory | null;
  salesPrice: number;
  cost: number;
  imageUrl: string | null;
  isArchived: boolean;
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  isArchived: boolean;
}

export interface Journal {
  id: number;
  name: string;
  type: JournalType;
  defaultAccountId: number | null;
  defaultAccount: Account | null;
  isArchived: boolean;
}

export interface AnalyticAccount {
  id: number;
  name: string;
  type: AnalyticType;
  isArchived: boolean;
}

export interface AnalyticBudgetUsage {
  budgetId: number;
  budgetName: string;
  status: BudgetStatus;
  startDate: string;
  endDate: string;
  committedAmount: number;
  achievedAmount: number;
  achievedPercent: number;
  amountToAchieve: number;
}

export interface AnalyticDetail extends AnalyticAccount {
  budgets: AnalyticBudgetUsage[];
}

export interface JournalItem {
  id: number;
  accountId: number;
  account: Account;
  partnerId: number | null;
  partner: { id: number; name: string } | null;
  label: string | null;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: number;
  number: string;
  date: string;
  journalId: number;
  journal: { id: number; name: string; type: JournalType };
  reference: string | null;
  partnerId: number | null;
  partner: { id: number; name: string } | null;
  status: EntryStatus;
  sourceType: string | null;
  sourceId: number | null;
  items: JournalItem[];
  totalDebit: number;
  totalCredit: number;
  total: number;
  balanced: boolean;
}

export interface BudgetLine {
  id: number;
  analyticId: number;
  analytic: AnalyticAccount;
  committedAmount: number;
  achievedAmount: number;
  achievedPercent: number;
  amountToAchieve: number;
}

export interface Budget {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  responsibleId: number | null;
  responsible: { id: number; name: string; email: string } | null;
  status: BudgetStatus;
  revisionOfId: number | null;
  revisionOf: { id: number; name: string; status: BudgetStatus } | null;
  revisedWith: { id: number; name: string; status: BudgetStatus } | null;
  isArchived: boolean;
  lines: BudgetLine[];
  totalCommitted: number;
  totalAchieved: number;
  totalToAchieve: number;
  achievedPercent: number;
}

export interface PurchaseOrderLine {
  id: number;
  sequence: number;
  productId: number;
  product: { id: number; name: string; cost: number };
  analyticId: number | null;
  analytic: AnalyticAccount | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: number;
  number: string;
  vendorId: number;
  vendor: Contact;
  date: string;
  status: DocStatus;
  total: number;
  lines: PurchaseOrderLine[];
  bills: { id: number; number: string; status: DocStatus }[];
}

export interface VendorBillLine extends PurchaseOrderLine {
  accountId: number;
  account: Account;
}

export interface VendorBill {
  id: number;
  number: string;
  vendorId: number;
  vendor: Contact;
  reference: string | null;
  billDate: string;
  dueDate: string | null;
  status: DocStatus;
  total: number;
  paidCash: number;
  paidBank: number;
  amountDue: number;
  purchaseOrderId: number | null;
  purchaseOrder: { id: number; number: string } | null;
  journalEntryId: number | null;
  journalEntry: { id: number; number: string; status: EntryStatus } | null;
  lines: VendorBillLine[];
  payments: { id: number; number: string; amount: number; via: PaymentVia; date: string }[];
  analyticIds: number[];
}

export interface SalesOrderLine {
  id: number;
  sequence: number;
  productId: number;
  product: { id: number; name: string; salesPrice: number };
  analyticId: number | null;
  analytic: AnalyticAccount | null;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

export interface SalesOrder {
  id: number;
  number: string;
  customerId: number;
  customer: Contact;
  date: string;
  status: DocStatus;
  subtotal: number;
  taxTotal: number;
  total: number;
  lines: SalesOrderLine[];
  invoices: { id: number; number: string; status: DocStatus }[];
}

export interface CustomerInvoiceLine extends SalesOrderLine {
  accountId: number;
  account: Account;
}

export interface CustomerInvoice {
  id: number;
  number: string;
  customerId: number;
  customer: Contact;
  reference: string | null;
  invoiceDate: string;
  dueDate: string | null;
  status: DocStatus;
  subtotal: number;
  taxTotal: number;
  total: number;
  paidCash: number;
  paidBank: number;
  amountDue: number;
  salesOrderId: number | null;
  salesOrder: { id: number; number: string } | null;
  journalEntryId: number | null;
  journalEntry: { id: number; number: string; status: EntryStatus } | null;
  lines: CustomerInvoiceLine[];
  payments: { id: number; number: string; amount: number; via: PaymentVia; date: string }[];
  analyticIds: number[];
}

export interface Payment {
  id: number;
  number: string;
  type: PaymentKind;
  partnerId: number;
  partner: { id: number; name: string; email: string };
  amount: number;
  date: string;
  via: PaymentVia;
  note: string | null;
  billId: number | null;
  bill: { id: number; number: string; status: DocStatus } | null;
  invoiceId: number | null;
  invoice: { id: number; number: string; status: DocStatus } | null;
  journalEntry: { id: number; number: string; status: EntryStatus } | null;
}

export interface DashboardDocumentRow {
  kind: 'INVOICE' | 'BILL';
  id: number;
  number: string;
  partner: string;
  date: string;
  dueDate: string | null;
  amountDue: number;
  overdue: boolean;
}

export interface DashboardSummary {
  purchase: { all: number; confirmed: number; draft: number };
  sales: { all: number; confirmed: number; draft: number };
  budgets: { achieved: number; budget: number; committed: number };
  budgetProgress: {
    id: number;
    name: string;
    committed: number;
    achieved: number;
    percent: number;
  }[];
  period: { from: string; to: string };
  financials: {
    income: number;
    expenses: number;
    netIncome: number;
    bank: number;
    cash: number;
    liquidity: number;
    receivable: number;
    payable: number;
  };
  monthly: { label: string; income: number; expense: number }[];
  receivables: { rows: DashboardDocumentRow[]; overdueCount: number };
  payables: { rows: DashboardDocumentRow[]; overdueCount: number };
  recentEntries: {
    id: number;
    number: string;
    date: string;
    journal: string;
    partner: string | null;
    total: number;
  }[];
}

export interface AccountBalance {
  accountId: number;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  balance: number;
}

export interface ProfitAndLoss {
  period: { from: string; to: string };
  income: { accounts: AccountBalance[]; total: number };
  expenses: {
    purchase: { accounts: AccountBalance[]; total: number };
    other: { accounts: AccountBalance[]; total: number };
    total: number;
  };
  netIncome: number;
}

export interface BalanceSheet {
  period: { from: string; to: string };
  assets: { accounts: AccountBalance[]; total: number };
  liabilities: { accounts: AccountBalance[]; total: number };
  capital: { accounts: AccountBalance[]; netIncome: number; total: number };
  totalAssets: number;
  totalLiabilitiesAndCapital: number;
  balanced: boolean;
  difference: number;
}

export interface StockRow {
  productId: number;
  productName: string;
  productType: ProductType;
  categoryName: string | null;
  openingQty: number;
  inQty: number;
  inValue: number;
  outQty: number;
  outValue: number;
  closingQty: number;
  unitCost: number;
  stockValue: number;
}

export interface StockReport {
  period: { from: string; to: string };
  rows: StockRow[];
  totals: {
    openingQty: number;
    inQty: number;
    inValue: number;
    outQty: number;
    outValue: number;
    closingQty: number;
    stockValue: number;
  };
}

export interface BudgetReportRow {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: BudgetStatus;
  responsible: { id: number; name: string } | null;
  committed: number;
  achieved: number;
  balance: number;
  achievedPercent: number;
}

export interface AchievedDocument {
  kind: 'INVOICE' | 'BILL';
  id: number;
  number: string;
  date: string;
  partner: string;
  analyticId: number;
  analyticName: string;
  status: DocStatus;
  amount: number;
}

export interface PortalDocument {
  id: number;
  number: string;
  reference: string | null;
  date: string;
  dueDate: string | null;
  status: DocStatus;
  total: number;
  paidCash: number;
  paidBank: number;
  amountDue: number;
  paymentStatus: 'Paid' | 'Unpaid';
}

export interface PortalDocuments {
  contact: Pick<Contact, 'id' | 'name' | 'email' | 'mobile' | 'imageUrl' | 'type'>;
  invoices: PortalDocument[];
  bills: PortalDocument[];
}

export interface AppUser {
  id: number;
  name: string;
  loginId: string;
  email: string;
  role: Role;
  isArchived: boolean;
  contactId: number | null;
  contact: { id: number; name: string } | null;
  createdAt: string;
}
