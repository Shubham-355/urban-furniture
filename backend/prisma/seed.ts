/**
 * Seed script for the Urban Furniture Accounting System.
 *
 * Loads every pre-configured master record the spec requires (Chart of
 * Accounts, Journals), demo contacts, products and analytics, one confirmed
 * budget, and a worked purchase and sales flow so the reports are not empty on
 * a first run.
 *
 * Run with `npm run db:seed`.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { computeDocumentTotals } from '../src/domain/totals';
import { buildCustomerInvoiceEntry, buildVendorBillEntry } from '../src/domain/journal';

const prisma = new PrismaClient();

const hash = (password: string) => bcrypt.hashSync(password, 10);

/** Demo documents are dated four weeks back so they sit inside the budget period. */
const today = new Date();
const daysAgo = (days: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  date.setHours(9, 0, 0, 0);
  return date;
};

async function reset() {
  // Child rows first - the schema uses restrictive foreign keys on purpose.
  await prisma.journalItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.customerInvoiceLine.deleteMany();
  await prisma.customerInvoice.deleteMany();
  await prisma.salesOrderLine.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.vendorBillLine.deleteMany();
  await prisma.vendorBill.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.analyticAccount.deleteMany();
  await prisma.journal.deleteMany();
  await prisma.account.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.sequence.deleteMany();
}

async function main() {
  console.log('Seeding Urban Furniture Accounting System...');
  await reset();

  // ---------------------------------------------------------------- accounts
  const accountSpecs = [
    { name: 'Bank A/c', type: 'BANK' },
    { name: 'Cash A/c', type: 'CASH' },
    { name: 'Debtors A/c', type: 'ASSET' },
    { name: 'Creditors A/c', type: 'LIABILITY' },
    { name: 'Tax Payable A/c', type: 'LIABILITY' },
    { name: 'Sales Income A/c', type: 'INCOME' },
    { name: 'Purchase Expense A/c', type: 'EXPENSE' },
    { name: 'Other Expense A/c', type: 'OTHER_EXPENSE' },
    { name: 'Capital A/c', type: 'CAPITAL' },
  ] as const;

  const accounts: Record<string, number> = {};
  for (const spec of accountSpecs) {
    const account = await prisma.account.create({ data: { name: spec.name, type: spec.type } });
    accounts[spec.name] = account.id;
  }

  // ---------------------------------------------------------------- journals
  const journalSpecs = [
    { name: 'Sales', type: 'SALES', account: 'Sales Income A/c' },
    { name: 'Purchase', type: 'PURCHASE', account: 'Purchase Expense A/c' },
    { name: 'Bank', type: 'BANK', account: 'Bank A/c' },
    { name: 'Cash', type: 'CASH', account: 'Cash A/c' },
  ] as const;

  const journals: Record<string, number> = {};
  for (const spec of journalSpecs) {
    const journal = await prisma.journal.create({
      data: { name: spec.name, type: spec.type, defaultAccountId: accounts[spec.account] },
    });
    journals[spec.type] = journal.id;
  }

  // ---------------------------------------------------------------- contacts
  const azure = await prisma.contact.create({
    data: {
      name: 'Azure Furniture',
      type: 'VENDOR',
      email: 'accounts@azurefurniture.in',
      mobile: '9876543210',
      street: '12 Industrial Estate',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      pincode: '380015',
    },
  });

  const nimesh = await prisma.contact.create({
    data: {
      name: 'Nimesh Pathak',
      type: 'CUSTOMER',
      email: 'nimesh.pathak@example.com',
      mobile: '9825011223',
      street: '48 Satellite Road',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      pincode: '380054',
    },
  });

  const rahul = await prisma.contact.create({
    data: {
      name: 'Rahul Sharma',
      type: 'VENDOR',
      email: 'rahul.sharma@example.com',
      mobile: '9911223344',
      city: 'Surat',
      state: 'Gujarat',
      country: 'India',
      pincode: '395003',
    },
  });

  await prisma.contact.create({
    data: {
      name: 'Open Wood',
      type: 'BOTH',
      email: 'hello@openwood.in',
      mobile: '9822334455',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      pincode: '411001',
    },
  });

  await prisma.contact.create({
    data: {
      name: 'Joey Wills',
      type: 'CUSTOMER',
      email: 'joey.wills@example.com',
      mobile: '9700112233',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      pincode: '400001',
    },
  });

  // ------------------------------------------------------------------- users
  await prisma.user.create({
    data: {
      name: 'Business Owner',
      loginId: 'admin1',
      email: 'admin@urbanfurniture.local',
      passwordHash: hash('Admin@123'),
      role: 'ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Invoicing User',
      loginId: 'acct01',
      email: 'accountant@urbanfurniture.local',
      passwordHash: hash('Acct@1234'),
      role: 'ACCOUNTANT',
    },
  });

  await prisma.user.create({
    data: {
      name: nimesh.name,
      loginId: 'nimesh01',
      email: nimesh.email,
      passwordHash: hash('Nimesh@123'),
      role: 'CONTACT',
      contactId: nimesh.id,
    },
  });

  // ---------------------------------------------------------------- products
  const categoryNames = ['Seating', 'Tables', 'Living Room', 'Appliances'];
  const categories: Record<string, number> = {};
  for (const name of categoryNames) {
    const category = await prisma.productCategory.create({ data: { name } });
    categories[name] = category.id;
  }

  const productSpecs = [
    { name: 'Office Chair', category: 'Seating', salesPrice: 5000, cost: 3500 },
    { name: 'Wooden Chair', category: 'Seating', salesPrice: 2500, cost: 2000 },
    { name: 'Wooden Table', category: 'Tables', salesPrice: 8000, cost: 5500 },
    { name: 'Dining Table', category: 'Tables', salesPrice: 15000, cost: 10000 },
    { name: 'Sofa', category: 'Living Room', salesPrice: 20000, cost: 14000 },
    { name: 'Air Conditioner', category: 'Appliances', salesPrice: 25000, cost: 15000 },
    { name: 'Refrigerator', category: 'Appliances', salesPrice: 10000, cost: 7000 },
  ];

  const products: Record<string, { id: number; salesPrice: number; cost: number }> = {};
  for (const spec of productSpecs) {
    const product = await prisma.product.create({
      data: {
        name: spec.name,
        type: 'GOODS',
        categoryId: categories[spec.category],
        salesPrice: spec.salesPrice,
        cost: spec.cost,
      },
    });
    products[spec.name] = { id: product.id, salesPrice: spec.salesPrice, cost: spec.cost };
  }

  // ---------------------------------------------------------------- analytics
  const furniture = await prisma.analyticAccount.create({
    data: { name: 'Furniture', type: 'EXPENSE' },
  });
  const projectOne = await prisma.analyticAccount.create({
    data: { name: 'Project 1', type: 'INCOME' },
  });
  await prisma.analyticAccount.create({
    data: { name: 'Project 1 - Expense', type: 'EXPENSE' },
  });

  // ------------------------------------------------------------------ budgets
  // Calendar year 2026 so the demo documents below fall inside the period.
  await prisma.budget.create({
    data: {
      name: 'Furniture Jan 2026',
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 11, 31),
      responsibleId: rahul.id,
      status: 'CONFIRMED',
      lines: { create: [{ analyticId: furniture.id, committedAmount: 200000 }] },
    },
  });

  await prisma.budget.create({
    data: {
      name: 'Project 1 Revenue 2026',
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 11, 31),
      responsibleId: nimesh.id,
      status: 'CONFIRMED',
      lines: { create: [{ analyticId: projectOne.id, committedAmount: 500000 }] },
    },
  });

  // --------------------------------------------------------------- sequences
  // The demo documents below take the first numbers of each sequence.
  const claim = async (key: string, year: number, next: number) => {
    await prisma.sequence.create({ data: { key, year, next } });
  };

  const year = today.getFullYear();
  await claim('PURCHASE_ORDER', 0, 2);
  await claim('SALES_ORDER', 0, 2);
  await claim('VENDOR_BILL', year, 2);
  await claim('CUSTOMER_INVOICE', year, 2);
  await claim('PAYMENT', year, 3);
  await claim('JOURNAL_ENTRY', year, 2);

  const pad = (value: number, width: number) => String(value).padStart(width, '0');

  // ------------------------------------------------- opening capital entry
  await prisma.journalEntry.create({
    data: {
      number: `JE/${year}/${pad(1, 4)}`,
      date: daysAgo(60),
      journalId: journals.BANK,
      reference: 'Opening capital',
      status: 'POSTED',
      sourceType: 'MANUAL',
      items: {
        create: [
          { accountId: accounts['Bank A/c'], label: 'Opening capital', debit: 100000, credit: 0 },
          { accountId: accounts['Capital A/c'], label: 'Opening capital', debit: 0, credit: 100000 },
        ],
      },
    },
  });

  // ------------------------------------------------------- purchase demo flow
  const poLines = [
    { productId: products['Wooden Chair'].id, analyticId: furniture.id, quantity: 3, unitPrice: 2000 },
  ];
  const poTotals = computeDocumentTotals(poLines);

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      number: `P${pad(1, 5)}`,
      vendorId: azure.id,
      date: daysAgo(28),
      status: 'BILLED',
      total: poTotals.total,
      lines: {
        create: poLines.map((line, index) => ({
          sequence: index + 1,
          productId: line.productId,
          analyticId: line.analyticId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: poTotals.lines[index].total,
        })),
      },
    },
  });

  const billDate = daysAgo(26);
  const billNumber = `Bill/${billDate.getFullYear()}/${pad(1, 4)}`;
  const bill = await prisma.vendorBill.create({
    data: {
      number: billNumber,
      vendorId: azure.id,
      reference: 'ABC-26-001',
      billDate,
      dueDate: daysAgo(-4),
      status: 'CONFIRMED',
      total: poTotals.total,
      paidBank: 0,
      paidCash: 0,
      purchaseOrderId: purchaseOrder.id,
      lines: {
        create: poLines.map((line, index) => ({
          sequence: index + 1,
          productId: line.productId,
          accountId: accounts['Purchase Expense A/c'],
          analyticId: line.analyticId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: poTotals.lines[index].total,
        })),
      },
    },
    include: { lines: true },
  });

  const billEntry = await prisma.journalEntry.create({
    data: {
      number: billNumber,
      date: billDate,
      journalId: journals.PURCHASE,
      reference: 'ABC-26-001',
      partnerId: azure.id,
      status: 'POSTED',
      sourceType: 'VENDOR_BILL',
      sourceId: bill.id,
      items: {
        create: buildVendorBillEntry({
          partnerId: azure.id,
          creditorsAccountId: accounts['Creditors A/c'],
          lines: bill.lines.map((line) => ({
            accountId: line.accountId,
            total: Number(line.total),
          })),
        }).map((item) => ({
          accountId: item.accountId,
          partnerId: item.partnerId ?? null,
          label: item.label ?? null,
          debit: item.debit,
          credit: item.credit,
        })),
      },
    },
  });

  await prisma.vendorBill.update({
    where: { id: bill.id },
    data: { journalEntryId: billEntry.id },
  });

  // Pay the bill in full via bank.
  const billPaymentDate = daysAgo(20);
  const billPaymentNumber = `PAY/${billPaymentDate.getFullYear()}/${pad(1, 4)}`;
  const billPaymentEntry = await prisma.journalEntry.create({
    data: {
      number: billPaymentNumber,
      date: billPaymentDate,
      journalId: journals.BANK,
      reference: billPaymentNumber,
      partnerId: azure.id,
      status: 'POSTED',
      sourceType: 'PAYMENT',
      items: {
        create: [
          {
            accountId: accounts['Creditors A/c'],
            partnerId: azure.id,
            label: 'Bill payment',
            debit: poTotals.total,
            credit: 0,
          },
          {
            accountId: accounts['Bank A/c'],
            partnerId: azure.id,
            label: 'Bill payment',
            debit: 0,
            credit: poTotals.total,
          },
        ],
      },
    },
  });

  const billPayment = await prisma.payment.create({
    data: {
      number: billPaymentNumber,
      type: 'SEND',
      partnerId: azure.id,
      amount: poTotals.total,
      date: billPaymentDate,
      via: 'BANK',
      note: 'Paid in full against ABC-26-001',
      billId: bill.id,
      journalEntryId: billPaymentEntry.id,
    },
  });

  await prisma.journalEntry.update({
    where: { id: billPaymentEntry.id },
    data: { sourceId: billPayment.id },
  });

  await prisma.vendorBill.update({
    where: { id: bill.id },
    data: { paidBank: poTotals.total, status: 'PAID' },
  });

  // ---------------------------------------------------------- sales demo flow
  const soLines = [
    {
      productId: products['Office Chair'].id,
      analyticId: projectOne.id,
      quantity: 5,
      unitPrice: products['Office Chair'].salesPrice,
      taxPercent: 0,
    },
  ];
  const soTotals = computeDocumentTotals(soLines);

  const salesOrder = await prisma.salesOrder.create({
    data: {
      number: `S${pad(1, 5)}`,
      customerId: nimesh.id,
      date: daysAgo(18),
      status: 'INVOICED',
      subtotal: soTotals.subtotal,
      taxTotal: soTotals.taxTotal,
      total: soTotals.total,
      lines: {
        create: soLines.map((line, index) => ({
          sequence: index + 1,
          productId: line.productId,
          analyticId: line.analyticId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxPercent: line.taxPercent,
          taxAmount: soTotals.lines[index].taxAmount,
          total: soTotals.lines[index].total,
        })),
      },
    },
  });

  const invoiceDate = daysAgo(16);
  const invoiceNumber = `INV/${invoiceDate.getFullYear()}/${pad(1, 4)}`;
  const invoice = await prisma.customerInvoice.create({
    data: {
      number: invoiceNumber,
      customerId: nimesh.id,
      reference: 'SO-DEMO-001',
      invoiceDate,
      dueDate: daysAgo(-14),
      status: 'CONFIRMED',
      subtotal: soTotals.subtotal,
      taxTotal: soTotals.taxTotal,
      total: soTotals.total,
      salesOrderId: salesOrder.id,
      lines: {
        create: soLines.map((line, index) => ({
          sequence: index + 1,
          productId: line.productId,
          accountId: accounts['Sales Income A/c'],
          analyticId: line.analyticId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxPercent: line.taxPercent,
          taxAmount: soTotals.lines[index].taxAmount,
          total: soTotals.lines[index].total,
        })),
      },
    },
    include: { lines: true },
  });

  const invoiceEntry = await prisma.journalEntry.create({
    data: {
      number: invoiceNumber,
      date: invoiceDate,
      journalId: journals.SALES,
      reference: 'SO-DEMO-001',
      partnerId: nimesh.id,
      status: 'POSTED',
      sourceType: 'CUSTOMER_INVOICE',
      sourceId: invoice.id,
      items: {
        create: buildCustomerInvoiceEntry({
          partnerId: nimesh.id,
          debtorsAccountId: accounts['Debtors A/c'],
          taxAccountId: accounts['Tax Payable A/c'],
          lines: invoice.lines.map((line) => ({
            accountId: line.accountId,
            subtotal: Number(line.total) - Number(line.taxAmount),
            taxAmount: Number(line.taxAmount),
          })),
        }).map((item) => ({
          accountId: item.accountId,
          partnerId: item.partnerId ?? null,
          label: item.label ?? null,
          debit: item.debit,
          credit: item.credit,
        })),
      },
    },
  });

  await prisma.customerInvoice.update({
    where: { id: invoice.id },
    data: { journalEntryId: invoiceEntry.id },
  });

  // Receive the invoice in full via cash.
  const receiptDate = daysAgo(10);
  const receiptNumber = `PAY/${receiptDate.getFullYear()}/${pad(2, 4)}`;
  const receiptEntry = await prisma.journalEntry.create({
    data: {
      number: receiptNumber,
      date: receiptDate,
      journalId: journals.CASH,
      reference: receiptNumber,
      partnerId: nimesh.id,
      status: 'POSTED',
      sourceType: 'PAYMENT',
      items: {
        create: [
          {
            accountId: accounts['Cash A/c'],
            partnerId: nimesh.id,
            label: 'Invoice receipt',
            debit: soTotals.total,
            credit: 0,
          },
          {
            accountId: accounts['Debtors A/c'],
            partnerId: nimesh.id,
            label: 'Invoice receipt',
            debit: 0,
            credit: soTotals.total,
          },
        ],
      },
    },
  });

  const receipt = await prisma.payment.create({
    data: {
      number: receiptNumber,
      type: 'RECEIVE',
      partnerId: nimesh.id,
      amount: soTotals.total,
      date: receiptDate,
      via: 'CASH',
      note: 'Received in full',
      invoiceId: invoice.id,
      journalEntryId: receiptEntry.id,
    },
  });

  await prisma.journalEntry.update({
    where: { id: receiptEntry.id },
    data: { sourceId: receipt.id },
  });

  await prisma.customerInvoice.update({
    where: { id: invoice.id },
    data: { paidCash: soTotals.total, status: 'PAID' },
  });

  // ------------------------------------------- one unpaid invoice for the portal
  const openInvoiceDate = daysAgo(4);
  const openInvoiceNumber = `INV/${openInvoiceDate.getFullYear()}/${pad(2, 4)}`;
  const openLines = [
    {
      productId: products['Dining Table'].id,
      analyticId: projectOne.id,
      quantity: 1,
      unitPrice: products['Dining Table'].salesPrice,
      taxPercent: 5,
    },
  ];
  const openTotals = computeDocumentTotals(openLines);

  const openInvoice = await prisma.customerInvoice.create({
    data: {
      number: openInvoiceNumber,
      customerId: nimesh.id,
      reference: 'WEB-26-014',
      invoiceDate: openInvoiceDate,
      dueDate: daysAgo(-26),
      status: 'CONFIRMED',
      subtotal: openTotals.subtotal,
      taxTotal: openTotals.taxTotal,
      total: openTotals.total,
      lines: {
        create: openLines.map((line, index) => ({
          sequence: index + 1,
          productId: line.productId,
          accountId: accounts['Sales Income A/c'],
          analyticId: line.analyticId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxPercent: line.taxPercent,
          taxAmount: openTotals.lines[index].taxAmount,
          total: openTotals.lines[index].total,
        })),
      },
    },
    include: { lines: true },
  });

  const openEntry = await prisma.journalEntry.create({
    data: {
      number: openInvoiceNumber,
      date: openInvoiceDate,
      journalId: journals.SALES,
      reference: 'WEB-26-014',
      partnerId: nimesh.id,
      status: 'POSTED',
      sourceType: 'CUSTOMER_INVOICE',
      sourceId: openInvoice.id,
      items: {
        create: buildCustomerInvoiceEntry({
          partnerId: nimesh.id,
          debtorsAccountId: accounts['Debtors A/c'],
          taxAccountId: accounts['Tax Payable A/c'],
          lines: openInvoice.lines.map((line) => ({
            accountId: line.accountId,
            subtotal: Number(line.total) - Number(line.taxAmount),
            taxAmount: Number(line.taxAmount),
          })),
        }).map((item) => ({
          accountId: item.accountId,
          partnerId: item.partnerId ?? null,
          label: item.label ?? null,
          debit: item.debit,
          credit: item.credit,
        })),
      },
    },
  });

  await prisma.customerInvoice.update({
    where: { id: openInvoice.id },
    data: { journalEntryId: openEntry.id },
  });

  await prisma.sequence.update({
    where: { key_year: { key: 'CUSTOMER_INVOICE', year: openInvoiceDate.getFullYear() } },
    data: { next: 3 },
  });

  console.log('Seed complete.');
  console.log('  Admin       admin1 / Admin@123');
  console.log('  Accountant  acct01 / Acct@1234');
  console.log('  Portal      nimesh01 / Nimesh@123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
