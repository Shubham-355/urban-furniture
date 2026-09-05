import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, downloadFile, errorMessage, printPdf } from '../../lib/api';
import type { Account, AnalyticAccount, Contact, CustomerInvoice, Product } from '../../lib/types';
import { formatDate, formatMoney, today, toDateInput } from '../../lib/format';
import { useRecord } from '../../hooks/useList';
import { useToast } from '../../app/ToastContext';
import { FormShell, SmartButton } from '../../components/shells';
import { ConfirmDialog, Field, Spinner, StatusBadge, TextInput } from '../../components/ui';
import { RecordPicker } from '../../components/RecordPicker';
import { PaymentDialog } from '../../components/PaymentEditor';

interface DraftLine {
  key: string;
  productId: number | null;
  accountId: number | null;
  analyticId: number | null;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

const emptyLine = (): DraftLine => ({
  key: Math.random().toString(36).slice(2),
  productId: null,
  accountId: null,
  analyticId: null,
  quantity: 1,
  unitPrice: 0,
  taxPercent: 0,
});

const lineTotals = (line: DraftLine) => {
  const subtotal = Math.round(Number(line.quantity || 0) * Number(line.unitPrice || 0) * 100) / 100;
  const tax = Math.round(subtotal * Number(line.taxPercent || 0)) / 100;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
};

export function CustomerInvoiceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { record, loading, reload } = useRecord<CustomerInvoice>('/customer-invoices', id);

  const [header, setHeader] = useState({
    customerId: null as number | null,
    reference: '',
    invoiceDate: today(),
    dueDate: '',
  });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'cancel' | 'reset' | null>(null);

  const editable = !record || record.status === 'DRAFT';

  useEffect(() => {
    if (!record) {
      setHeader({ customerId: null, reference: '', invoiceDate: today(), dueDate: '' });
      setLines([emptyLine()]);
      return;
    }
    setHeader({
      customerId: record.customerId,
      reference: record.reference ?? '',
      invoiceDate: toDateInput(record.invoiceDate),
      dueDate: toDateInput(record.dueDate),
    });
    setLines(
      record.lines.map((line) => ({
        key: String(line.id),
        productId: line.productId,
        accountId: line.accountId,
        analyticId: line.analyticId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxPercent: line.taxPercent,
      })),
    );
  }, [record]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const line of lines) {
      const computed = lineTotals(line);
      subtotal += computed.subtotal;
      tax += computed.tax;
    }
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((subtotal + tax) * 100) / 100,
    };
  }, [lines]);

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const save = async (): Promise<CustomerInvoice | null> => {
    const payload = {
      customerId: header.customerId,
      reference: header.reference || null,
      invoiceDate: header.invoiceDate,
      dueDate: header.dueDate || null,
      lines: lines
        .filter((line) => line.productId)
        .map((line) => ({
          productId: line.productId,
          accountId: line.accountId,
          analyticId: line.analyticId,
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(line.unitPrice) || 0,
          taxPercent: Number(line.taxPercent) || 0,
        })),
    };
    if (!payload.customerId) {
      toast.error('Choose a customer');
      return null;
    }
    if (payload.lines.length === 0) {
      toast.error('Add at least one product line');
      return null;
    }

    setBusy(true);
    try {
      if (record) {
        const { data } = await api.put<CustomerInvoice>(`/customer-invoices/${record.id}`, payload);
        toast.success('Invoice saved');
        await reload();
        return data;
      }
      const { data } = await api.post<CustomerInvoice>('/customer-invoices', payload);
      toast.success(`Invoice ${data.number} created`);
      navigate(`/sales/invoices/${data.id}`, { replace: true });
      return data;
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the invoice'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const act = async (path: string, message: string) => {
    if (!record) return;
    setConfirmDialog(null);
    try {
      await api.post(`/customer-invoices/${record.id}/${path}`);
      toast.success(message);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'The action could not be completed'));
    }
  };

  const confirmInvoice = async () => {
    const saved = record ?? (await save());
    if (!saved) return;
    try {
      await api.post(`/customer-invoices/${saved.id}/confirm`);
      toast.success('Invoice confirmed and journal entry posted');
      navigate(`/sales/invoices/${saved.id}`, { replace: true });
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not confirm the invoice'));
    }
  };

  const print = async () => {
    if (!record) return;
    try {
      await printPdf(`/customer-invoices/${record.id}/pdf`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not open the print dialog'));
    }
  };

  const download = async () => {
    if (!record) return;
    try {
      await downloadFile(
        `/customer-invoices/${record.id}/pdf`,
        `${record.number.replace(/\//g, '-')}.pdf`,
      );
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download the PDF'));
    }
  };

  const send = async () => {
    if (!record) return;
    try {
      const { data } = await api.post<{ message: string }>(`/customer-invoices/${record.id}/send`);
      toast.info(data.message);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not send the invoice'));
    }
  };

  if (loading) return <Spinner />;

  return (
    <FormShell
      title={record ? record.number : 'New Customer Invoice'}
      subtitle="On confirm: Debit Debtors A/c, Credit Sales Income A/c (and Tax Payable A/c for tax)."
      status={record ? <StatusBadge status={record.status} /> : null}
      backTo="/sales/invoices"
      onNew={() => navigate('/sales/invoices/new')}
      onConfirm={editable ? () => void (record ? confirmInvoice() : save()) : undefined}
      confirmLabel={record ? 'Confirm' : 'Save'}
      confirmDisabled={busy}
      smartButtons={
        <>
          {record?.salesOrder ? (
            <SmartButton
              label="SO"
              value={record.salesOrder.number}
              onClick={() => navigate(`/sales/orders/${record.salesOrder!.id}`)}
            />
          ) : null}
          {record && record.analyticIds.length > 0 ? (
            <SmartButton
              label="Budget"
              value="Analytic report"
              onClick={() => navigate(`/report/budget-analytic/${record.analyticIds[0]}`)}
            />
          ) : null}
          {record?.journalEntry ? (
            <SmartButton
              label="Journal Entry"
              value={record.journalEntry.number}
              onClick={() => navigate(`/account/journal-entries/${record.journalEntry!.id}`)}
            />
          ) : null}
        </>
      }
      actions={
        <>
          {record && record.status === 'DRAFT' ? (
            <button type="button" className="btn-secondary" onClick={() => void save()}>
              Save
            </button>
          ) : null}
          {record && record.status === 'CONFIRMED' && record.amountDue > 0 ? (
            <button type="button" className="btn-primary" onClick={() => setPayOpen(true)}>
              Pay
            </button>
          ) : null}
          {record ? (
            <button type="button" className="btn-secondary" onClick={() => void print()}>
              Print
            </button>
          ) : null}
          {record ? (
            <button type="button" className="btn-secondary" onClick={() => void download()}>
              Download
            </button>
          ) : null}
          {record ? (
            <button type="button" className="btn-secondary" onClick={() => void send()}>
              Send
            </button>
          ) : null}
          {record && record.status === 'CONFIRMED' ? (
            <button type="button" className="btn-secondary" onClick={() => setConfirmDialog('reset')}>
              Reset to Draft
            </button>
          ) : null}
          {record && record.status !== 'CANCELLED' && record.status !== 'PAID' ? (
            <button type="button" className="btn-secondary" onClick={() => setConfirmDialog('cancel')}>
              Cancel
            </button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Customer Invoice No.">
          <TextInput value={record?.number ?? 'Generated on save'} disabled readOnly />
        </Field>
        <Field label="Customer Name">
          <RecordPicker<Contact>
            endpoint="/contacts"
            params={{ status: 'CUSTOMER' }}
            value={header.customerId}
            disabled={!editable}
            onChange={(customerId) => setHeader({ ...header, customerId })}
            placeholder="Select a customer"
          />
        </Field>
        <Field label="Invoice Reference">
          <TextInput
            value={header.reference}
            disabled={!editable}
            onChange={(event) => setHeader({ ...header, reference: event.target.value })}
            placeholder="Reference"
          />
        </Field>
        <Field label="Invoice Date">
          <TextInput
            type="date"
            value={header.invoiceDate}
            disabled={!editable}
            onChange={(event) => setHeader({ ...header, invoiceDate: event.target.value })}
          />
        </Field>
        <Field label="Due Date">
          <TextInput
            type="date"
            value={header.dueDate}
            disabled={!editable}
            onChange={(event) => setHeader({ ...header, dueDate: event.target.value })}
          />
        </Field>
        <Field label="Status">
          <TextInput value={record?.status ?? 'DRAFT'} disabled readOnly />
        </Field>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
        <table className="table">
          <thead>
            <tr>
              <th className="w-14">Sr. No.</th>
              <th className="min-w-[170px]">Product</th>
              <th className="min-w-[180px]">Chart of Accounts</th>
              <th className="min-w-[160px]">Budget Analytics</th>
              <th className="w-20 text-right">Qty</th>
              <th className="w-28 text-right">Unit Price</th>
              <th className="w-20 text-right">Tax %</th>
              <th className="w-28 text-right">Total</th>
              {editable ? <th className="w-12" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const computed = lineTotals(line);
              return (
                <tr key={line.key}>
                  <td>{index + 1}</td>
                  <td>
                    <RecordPicker<Product>
                      endpoint="/products"
                      value={line.productId}
                      disabled={!editable}
                      onChange={(productId, product) =>
                        update(line.key, {
                          productId,
                          unitPrice: product ? product.salesPrice : line.unitPrice,
                        })
                      }
                      placeholder="Product"
                    />
                  </td>
                  <td>
                    <RecordPicker<Account>
                      endpoint="/accounts"
                      value={line.accountId}
                      disabled={!editable}
                      onChange={(accountId) => update(line.key, { accountId })}
                      placeholder="Sales Income A/c"
                    />
                  </td>
                  <td>
                    <RecordPicker<AnalyticAccount>
                      endpoint="/analytics"
                      params={{ status: 'INCOME' }}
                      value={line.analyticId}
                      disabled={!editable}
                      onChange={(analyticId) => update(line.key, { analyticId })}
                      placeholder="Analytic"
                      emptyLabel="No income analytics"
                    />
                  </td>
                  <td>
                    <TextInput
                      type="number"
                      min={0}
                      step="0.01"
                      className="text-right"
                      value={line.quantity}
                      disabled={!editable}
                      onChange={(event) => update(line.key, { quantity: Number(event.target.value) })}
                    />
                  </td>
                  <td>
                    <TextInput
                      type="number"
                      min={0}
                      step="0.01"
                      className="text-right"
                      value={line.unitPrice}
                      disabled={!editable}
                      onChange={(event) => update(line.key, { unitPrice: Number(event.target.value) })}
                    />
                  </td>
                  <td>
                    <TextInput
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className="text-right"
                      value={line.taxPercent}
                      disabled={!editable}
                      onChange={(event) =>
                        update(line.key, { taxPercent: Number(event.target.value) })
                      }
                    />
                  </td>
                  <td className="text-right font-semibold">{formatMoney(computed.total)}</td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-rose-600"
                        aria-label="Remove line"
                        onClick={() =>
                          setLines((current) =>
                            current.length > 1
                              ? current.filter((item) => item.key !== line.key)
                              : current,
                          )
                        }
                      >
                        &times;
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editable ? (
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          Add a line
        </button>
      ) : null}

      <div className="mt-6 flex justify-end">
        <dl className="w-full max-w-sm space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal</dt>
            <dd>{formatMoney(record?.subtotal ?? totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Tax</dt>
            <dd>{formatMoney(record?.taxTotal ?? totals.tax)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Total</dt>
            <dd className="font-semibold">{formatMoney(record?.total ?? totals.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Paid Via Cash</dt>
            <dd>{formatMoney(record?.paidCash ?? 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Paid Via Bank</dt>
            <dd>{formatMoney(record?.paidBank ?? 0)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base">
            <dt className="font-bold text-slate-700">Amount Due</dt>
            <dd className="font-bold text-slate-900">
              {formatMoney(record ? record.amountDue : totals.total)}
            </dd>
          </div>
        </dl>
      </div>

      {record && record.payments.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Receipts</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Via</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {record.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-semibold text-slate-900">{payment.number}</td>
                    <td>{formatDate(payment.date)}</td>
                    <td>{payment.via === 'BANK' ? 'Bank' : 'Cash'}</td>
                    <td className="text-right">{formatMoney(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {record ? (
        <PaymentDialog
          open={payOpen}
          title={`Receive payment for ${record.number}`}
          defaults={{
            type: 'RECEIVE',
            partnerId: record.customerId,
            partnerName: record.customer.name,
            amount: record.amountDue,
            maxAmount: record.amountDue,
            invoiceId: record.id,
            documentNumber: record.number,
          }}
          onDone={() => {
            setPayOpen(false);
            void reload();
          }}
          onCancel={() => setPayOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDialog === 'reset'}
        title="Reset to draft"
        message="The generated journal entry will be cancelled and the invoice returns to draft."
        confirmLabel="Reset to Draft"
        onConfirm={() => void act('reset-draft', 'Invoice reset to draft')}
        onCancel={() => setConfirmDialog(null)}
      />
      <ConfirmDialog
        open={confirmDialog === 'cancel'}
        title="Cancel invoice"
        message="The invoice is cancelled and its journal entry is reversed out of the reports."
        confirmLabel="Cancel invoice"
        onConfirm={() => void act('cancel', 'Invoice cancelled')}
        onCancel={() => setConfirmDialog(null)}
      />
    </FormShell>
  );
}
