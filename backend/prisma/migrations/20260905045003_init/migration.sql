-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ACCOUNTANT', 'CONTACT');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('CUSTOMER', 'VENDOR', 'BOTH');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('GOODS', 'SERVICE', 'COMBO');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'BANK', 'CAPITAL', 'CASH', 'INCOME', 'EXPENSE', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('SALES', 'PURCHASE', 'BANK', 'CASH');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnalyticType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'REVISED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'BILLED', 'INVOICED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('SEND', 'RECEIVE');

-- CreateEnum
CREATE TYPE "PaymentVia" AS ENUM ('BANK', 'CASH');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ACCOUNTANT',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "contactId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'CUSTOMER',
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pincode" TEXT,
    "imageUrl" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'GOODS',
    "categoryId" INTEGER,
    "salesPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "JournalType" NOT NULL,
    "defaultAccountId" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticAccount" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AnalyticType" NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "journalId" INTEGER NOT NULL,
    "reference" TEXT,
    "partnerId" INTEGER,
    "status" "EntryStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceType" TEXT,
    "sourceId" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalItem" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "partnerId" INTEGER,
    "label" TEXT,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "JournalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "responsibleId" INTEGER,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "revisionOfId" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" SERIAL NOT NULL,
    "budgetId" INTEGER NOT NULL,
    "analyticId" INTEGER NOT NULL,
    "committedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "productId" INTEGER NOT NULL,
    "analyticId" INTEGER,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBill" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "reference" TEXT,
    "billDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidCash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidBank" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchaseOrderId" INTEGER,
    "journalEntryId" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBillLine" (
    "id" SERIAL NOT NULL,
    "billId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "productId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "analyticId" INTEGER,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "VendorBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "productId" INTEGER NOT NULL,
    "analyticId" INTEGER,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInvoice" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "reference" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidCash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidBank" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salesOrderId" INTEGER,
    "journalEntryId" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInvoiceLine" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "productId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "analyticId" INTEGER,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "CustomerInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "via" "PaymentVia" NOT NULL DEFAULT 'BANK',
    "note" TEXT,
    "billId" INTEGER,
    "invoiceId" INTEGER,
    "journalEntryId" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_contactId_key" ON "User"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "Account"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_name_key" ON "Journal"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticAccount_name_key" ON "AnalyticAccount"("name");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "JournalEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "JournalItem_entryId_idx" ON "JournalItem"("entryId");

-- CreateIndex
CREATE INDEX "JournalItem_accountId_idx" ON "JournalItem"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_revisionOfId_key" ON "Budget"("revisionOfId");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_orderId_idx" ON "PurchaseOrderLine"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorBill_number_key" ON "VendorBill"("number");

-- CreateIndex
CREATE UNIQUE INDEX "VendorBill_journalEntryId_key" ON "VendorBill"("journalEntryId");

-- CreateIndex
CREATE INDEX "VendorBillLine_billId_idx" ON "VendorBillLine"("billId");

-- CreateIndex
CREATE INDEX "VendorBillLine_analyticId_idx" ON "VendorBillLine"("analyticId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_number_key" ON "SalesOrder"("number");

-- CreateIndex
CREATE INDEX "SalesOrderLine_orderId_idx" ON "SalesOrderLine"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoice_number_key" ON "CustomerInvoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoice_journalEntryId_key" ON "CustomerInvoice"("journalEntryId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_invoiceId_idx" ON "CustomerInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_analyticId_idx" ON "CustomerInvoiceLine"("analyticId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_number_key" ON "Payment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_journalEntryId_key" ON "Payment"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_key_year_key" ON "Sequence"("key", "year");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_defaultAccountId_fkey" FOREIGN KEY ("defaultAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalItem" ADD CONSTRAINT "JournalItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalItem" ADD CONSTRAINT "JournalItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalItem" ADD CONSTRAINT "JournalItem_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_revisionOfId_fkey" FOREIGN KEY ("revisionOfId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_analyticId_fkey" FOREIGN KEY ("analyticId") REFERENCES "AnalyticAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_analyticId_fkey" FOREIGN KEY ("analyticId") REFERENCES "AnalyticAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillLine" ADD CONSTRAINT "VendorBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillLine" ADD CONSTRAINT "VendorBillLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillLine" ADD CONSTRAINT "VendorBillLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillLine" ADD CONSTRAINT "VendorBillLine_analyticId_fkey" FOREIGN KEY ("analyticId") REFERENCES "AnalyticAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_analyticId_fkey" FOREIGN KEY ("analyticId") REFERENCES "AnalyticAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_analyticId_fkey" FOREIGN KEY ("analyticId") REFERENCES "AnalyticAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
