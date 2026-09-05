import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, downloadFile, errorMessage } from '../../lib/api';
import type { Account, AnalyticAccount, Contact, Product, VendorBill } from '../../lib/types';
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
}

const emptyLine = (): DraftLine => ({
  key: Math.random().toString(36).slice(2),
  productId: null,
  accountId: null,
  analyticId: null,
  quantity: 1,
  unitPrice: 0,
});

export function VendorBillFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const { record, loading, reload } = useRecord<VendorBill>('/vendor-bills', id);

  const [header, setHeader] = useState({
    vendorId: null as number | null,
    reference: '',
    billDate: today(),
    dueDate: '',
  });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'cancel' | 'reset' | null>(null);

  const editable = !record || record.status === 'DRAFT';

  useEffect(() => {
    if (!record) {
      setHeader({
        vendorId: searchParams.get('vendorId') ? Number(searchParams.get('vendorId')) : null,
        reference: '',
        billDate: today(),
        dueDate: '',
      });
      setLines([emptyLine()]);
      return;
    }
    setHeader({
      vendorId: record.vendorId,
      reference: record.reference ?? '',
      billDate: toDateInput(record.billDate),
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
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  const total = useMemo(
    () =>
      Math.round(
        lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0) *
          100,
      ) / 100,
    [lines],
  );

  const paidCash = record?.paidCash ?? 0;
  const paidBank = record?.paidBank ?? 0;
  const amountDue = record ? record.amountDue : total;

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const save = async (): Promise<VendorBill | null> => {
    const payload = {
      vendorId: header.vendorId,
      reference: header.reference || null,
      billDate: header.billDate,
      dueDate: header.dueDate || null,
      lines: lines
        .filter((line) => line.productId)
        .map((line) => ({
          productId: line.productId,
          accountId: line.accountId,
          analyticId: line.analyticId,
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(line.unitPrice) || 0,
        })),
    };
    if (!payload.vendorId) {
      toast.error('Choose a vendor');
      return null;
    }
    if (payload.lines.length === 0) {
      toast.error('Add at least one product line');
      return null;
    }

    setBusy(true);
    try {
      if (record) {
        const { data } = await api.put<VendorBill>(`/vendor-bills/${record.id}`, payload);
        toast.success('Bill saved');
        await reload();
        return data;
      }
      const { data } = await api.post<VendorBill>('/vendor-bills', payload);
      toast.success(`Bill ${data.number} created`);
      navigate(`/purchase/bills/${data.id}`, { replace: true });
      return data;
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the bill'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const act = async (path: string, message: string) => {
    if (!record) return;
    setConfirmDialog(null);
    try {
      await api.post(`/vendor-bills/${record.id}/${path}`);
      toast.success(message);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'The action could not be completed'));
    }
  };

  const confirmBill = async () => {
    const saved = record ?? (await save());
    if (!saved) return;
    try {
      await api.post(`/vendor-bills/${saved.id}/confirm`);
      toast.success('Bill confirmed and journal entry posted');
      navigate(`/purchase/bills/${saved.id}`, { replace: true });
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not confirm the bill'));
    }
  };

  const print = async () => {
    if (!record) return;
    try {
      await downloadFile(`/vendor-bills/${record.id}/pdf`, `${record.number.replace(/\//g, '-')}.pdf`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download the PDF'));
    }
  };

  const send = async () => {
    if (!record) return;
    try {
      const { data } = await api.post<{ message: string }>(`/vendor-bills/${record.id}/send`);
      toast.info(data.message);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not send the bill'));
    }
  };

  if (loading) return <Spinner />;

  return (
    <FormShell
      title={record ? record.number : 'New Vendor Bill'}
      subtitle="On confirm: Debit the account on each line, Credit Creditors A/c."
      status={record ? <StatusBadge status={record.status} /> : null}
      backTo="/purchase/bills"
      onNew={() => navigate('/purchase/bills/new')}
      onConfirm={editable ? () => void (record ? confirmBill() : save()) : undefined}
      confirmLabel={record ? 'Confirm' : 'Save'}
      confirmDisabled={busy}
      smartButtons={
        <>
          {record?.purchaseOrder ? (
            <SmartButton
              label="PO"
              value={record.purchaseOrder.number}
              onClick={() => navigate(`/purchase/orders/${record.purchaseOrder!.id}`)}
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
            <button type="button" className="btn-secondary" onClick={() => void send()}>
              Send
            </button>
          ) : null}
          {record && record.status === 'CONFIRMED' ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmDialog('reset')}
            >
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
        <Field label="Vendor Bill No.">
          <TextInput value={record?.number ?? 'Generated on save'} disabled readOnly />
        </Field>
        <Field label="Vendor Name">
          <RecordPicker<Contact>
            endpoint="/contacts"
            params={{ status: 'VENDOR' }}
            value={header.vendorId}
            disabled={!editable}
            onChange={(vendorId) => setHeader({ ...header, vendorId })}
            placeholder="Select a vendor"
          />
        </Field>
        <Field label="Bill Reference">
          <TextInput
            value={header.reference}
            disabled={!editable}
            onChange={(event) => setHeader({ ...header, reference: event.target.value })}
            placeholder="ABC-26-001"
          />
        </Field>
        <Field label="Bill Date">
          <TextInput
            type="date"
            value={header.billDate}
            disabled={!editable}
            onChange={(event) => setHeader({ ...header, billDate: event.target.value })}
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
              <th className="min-w-[180px]">Product</th>
              <th className="min-w-[190px]">Chart of Account</th>
              <th className="min-w-[170px]">Budget Analytics</th>
              <th className="w-24 text-right">Qty</th>
              <th className="w-32 text-right">Unit Price</th>
              <th className="w-32 text-right">Total</th>
              {editable ? <th className="w-12" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
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
                        unitPrice: product ? product.cost : line.unitPrice,
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
                    placeholder="Purchase Expense A/c"
                  />
                </td>
                <td>
                  <RecordPicker<AnalyticAccount>
                    endpoint="/analytics"
                    params={{ status: 'EXPENSE' }}
                    value={line.analyticId}
                    disabled={!editable}
                    onChange={(analyticId) => update(line.key, { analyticId })}
                    placeholder="Analytic"
                    emptyLabel="No expense analytics"
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
                <td className="text-right font-semibold">
                  {formatMoney(Number(line.quantity || 0) * Number(line.unitPrice || 0))}
                </td>
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
            ))}
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
            <dt className="text-slate-500">Total</dt>
            <dd className="font-semibold text-slate-900">{formatMoney(record?.total ?? total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Paid Via Cash</dt>
            <dd>{formatMoney(paidCash)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Paid Via Bank</dt>
            <dd>{formatMoney(paidBank)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base">
            <dt className="font-bold text-slate-700">Amount Due</dt>
            <dd className="font-bold text-slate-900">{formatMoney(amountDue)}</dd>
          </div>
        </dl>
      </div>

      {record && record.payments.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Payments</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Payment</th>
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
          title={`Pay ${record.number}`}
          defaults={{
            type: 'SEND',
            partnerId: record.vendorId,
            partnerName: record.vendor.name,
            amount: record.amountDue,
            maxAmount: record.amountDue,
            billId: record.id,
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
        message="The generated journal entry will be cancelled and the bill returns to draft."
        confirmLabel="Reset to Draft"
        onConfirm={() => void act('reset-draft', 'Bill reset to draft')}
        onCancel={() => setConfirmDialog(null)}
      />
      <ConfirmDialog
        open={confirmDialog === 'cancel'}
        title="Cancel bill"
        message="The bill is cancelled and its journal entry is reversed out of the reports."
        confirmLabel="Cancel bill"
        onConfirm={() => void act('cancel', 'Bill cancelled')}
        onCancel={() => setConfirmDialog(null)}
      />
    </FormShell>
  );
}
