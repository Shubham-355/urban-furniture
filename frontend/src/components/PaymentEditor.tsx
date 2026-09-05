import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { Contact, Payment, PaymentKind, PaymentVia } from '../lib/types';
import { formatMoney, today } from '../lib/format';
import { useToast } from '../app/ToastContext';
import { Field, SelectInput, TextInput } from './ui';
import { RecordPicker } from './RecordPicker';

export interface PaymentDefaults {
  type: PaymentKind;
  partnerId: number | null;
  partnerName?: string;
  amount: number;
  /** Cap taken from the document being settled. */
  maxAmount?: number;
  via?: PaymentVia;
  billId?: number | null;
  invoiceId?: number | null;
  documentNumber?: string;
}

/**
 * The Payment / Receipt form. The same component backs Purchase > Payment,
 * Sales > Receipt and the Pay button on a bill or invoice.
 */
export function PaymentEditor({
  defaults,
  lockPartner = false,
  onDone,
  onCancel,
}: {
  defaults: PaymentDefaults;
  lockPartner?: boolean;
  onDone: (payment: Payment) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    type: defaults.type,
    partnerId: defaults.partnerId,
    amount: defaults.amount,
    date: today(),
    via: defaults.via ?? 'BANK',
    note: '',
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.partnerId) {
      toast.error('Choose a partner');
      return;
    }
    if (Number(form.amount) <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    if (defaults.maxAmount !== undefined && Number(form.amount) > defaults.maxAmount) {
      toast.error(`Amount cannot exceed the amount due of ${formatMoney(defaults.maxAmount)}`);
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post<Payment>('/payments', {
        type: form.type,
        partnerId: form.partnerId,
        amount: Number(form.amount),
        date: form.date,
        via: form.via,
        note: form.note || null,
        billId: defaults.billId ?? null,
        invoiceId: defaults.invoiceId ?? null,
      });
      toast.success(`Payment ${data.number} recorded`);
      onDone(data);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not record the payment'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {defaults.documentNumber ? (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Settling <strong>{defaults.documentNumber}</strong>
          {defaults.maxAmount !== undefined ? (
            <> - amount due {formatMoney(defaults.maxAmount)}</>
          ) : null}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Payment Type">
          <SelectInput
            value={form.type}
            disabled={Boolean(defaults.billId || defaults.invoiceId)}
            onChange={(event) => setForm({ ...form, type: event.target.value as PaymentKind })}
          >
            <option value="SEND">Send</option>
            <option value="RECEIVE">Receive</option>
          </SelectInput>
        </Field>

        <Field label="Partner">
          <RecordPicker<Contact>
            endpoint="/contacts"
            value={form.partnerId}
            disabled={lockPartner}
            onChange={(partnerId) => setForm({ ...form, partnerId })}
            placeholder={defaults.partnerName ?? 'Select a partner'}
          />
        </Field>

        <Field label="Amount (Rs.)">
          <TextInput
            type="number"
            min={0}
            step="0.01"
            max={defaults.maxAmount}
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
          />
        </Field>

        <Field label="Date">
          <TextInput
            type="date"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </Field>

        <Field label="Payment Via">
          <SelectInput
            value={form.via}
            onChange={(event) => setForm({ ...form, via: event.target.value as PaymentVia })}
          >
            <option value="BANK">Bank</option>
            <option value="CASH">Cash</option>
          </SelectInput>
        </Field>

        <Field label="Note">
          <TextInput
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            placeholder="Optional note"
          />
        </Field>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        {form.type === 'SEND'
          ? `On confirm: Debit Creditors A/c, Credit ${form.via === 'BANK' ? 'Bank' : 'Cash'} A/c.`
          : `On confirm: Debit ${form.via === 'BANK' ? 'Bank' : 'Cash'} A/c, Credit Debtors A/c.`}
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Saving...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

/** Modal wrapper used by the Pay button on a bill or an invoice. */
export function PaymentDialog({
  open,
  title,
  defaults,
  onDone,
  onCancel,
}: {
  open: boolean;
  title: string;
  defaults: PaymentDefaults;
  onDone: (payment: Payment) => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-base font-bold text-slate-900">{title}</h2>
        <PaymentEditor defaults={defaults} lockPartner onDone={onDone} onCancel={onCancel} />
      </div>
    </div>
  );
}
