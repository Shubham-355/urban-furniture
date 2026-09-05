import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import type { AnalyticAccount, Contact, Product, SalesOrder } from '../../lib/types';
import { formatMoney, today, toDateInput } from '../../lib/format';
import { useRecord } from '../../hooks/useList';
import { useToast } from '../../app/ToastContext';
import { FormShell, SmartButton } from '../../components/shells';
import { ConfirmDialog, Field, Spinner, StatusBadge, TextInput } from '../../components/ui';
import { RecordPicker } from '../../components/RecordPicker';

interface DraftLine {
  key: string;
  productId: number | null;
  analyticId: number | null;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

const emptyLine = (): DraftLine => ({
  key: Math.random().toString(36).slice(2),
  productId: null,
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

export function SalesOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { record, loading, reload } = useRecord<SalesOrder>('/sales-orders', id);

  const [header, setHeader] = useState({ customerId: null as number | null, date: today() });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const editable = !record || record.status === 'DRAFT';

  useEffect(() => {
    if (!record) {
      setHeader({ customerId: null, date: today() });
      setLines([emptyLine()]);
      return;
    }
    setHeader({ customerId: record.customerId, date: toDateInput(record.date) });
    setLines(
      record.lines.map((line) => ({
        key: String(line.id),
        productId: line.productId,
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

  const save = async (): Promise<SalesOrder | null> => {
    const payload = {
      customerId: header.customerId,
      date: header.date,
      lines: lines
        .filter((line) => line.productId)
        .map((line) => ({
          productId: line.productId,
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
        const { data } = await api.put<SalesOrder>(`/sales-orders/${record.id}`, payload);
        toast.success('Sales order saved');
        await reload();
        return data;
      }
      const { data } = await api.post<SalesOrder>('/sales-orders', payload);
      toast.success(`Sales order ${data.number} created`);
      navigate(`/sales/orders/${data.id}`, { replace: true });
      return data;
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the sales order'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const confirmOrder = async () => {
    const saved = record ?? (await save());
    if (!saved) return;
    try {
      await api.post(`/sales-orders/${saved.id}/confirm`);
      toast.success('Sales order confirmed');
      navigate(`/sales/orders/${saved.id}`, { replace: true });
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not confirm the sales order'));
    }
  };

  const createInvoice = async () => {
    if (!record) return;
    try {
      const { data } = await api.post<{ id: number; number: string }>(
        `/sales-orders/${record.id}/create-invoice`,
      );
      toast.success(`Invoice ${data.number} created`);
      navigate(`/sales/invoices/${data.id}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the invoice'));
    }
  };

  const cancel = async () => {
    setConfirmCancel(false);
    if (!record) {
      navigate('/sales/orders');
      return;
    }
    try {
      await api.post(`/sales-orders/${record.id}/cancel`);
      toast.success('Sales order cancelled');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not cancel the sales order'));
    }
  };

  if (loading) return <Spinner />;

  return (
    <FormShell
      title={record ? record.number : 'New Sales Order'}
      subtitle="Confirming a sales order creates no journal entry - the invoice does that."
      status={record ? <StatusBadge status={record.status} /> : null}
      backTo="/sales/orders"
      onNew={() => navigate('/sales/orders/new')}
      onConfirm={editable ? () => void (record ? confirmOrder() : save()) : undefined}
      confirmLabel={record ? 'Confirm' : 'Save'}
      confirmDisabled={busy}
      smartButtons={
        record && record.invoices.length > 0 ? (
          <SmartButton
            label="Invoice"
            value={record.invoices[0].number}
            onClick={() => navigate(`/sales/invoices/${record.invoices[0].id}`)}
          />
        ) : null
      }
      actions={
        <>
          {record && record.status === 'DRAFT' ? (
            <button type="button" className="btn-secondary" onClick={() => void save()}>
              Save
            </button>
          ) : null}
          {record?.status === 'CONFIRMED' ? (
            <button type="button" className="btn-primary" onClick={() => void createInvoice()}>
              Create Invoice
            </button>
          ) : null}
          {record && record.status !== 'CANCELLED' ? (
            <button type="button" className="btn-secondary" onClick={() => setConfirmCancel(true)}>
              Cancel
            </button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="SO No.">
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
        <Field label="SO Date">
          <TextInput
            type="date"
            value={header.date}
            disabled={!editable}
            onChange={(event) => setHeader({ ...header, date: event.target.value })}
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
              <th className="min-w-[190px]">Product</th>
              <th className="min-w-[180px]">Budget Analytics</th>
              <th className="w-24 text-right">Qty</th>
              <th className="w-32 text-right">Unit Price</th>
              <th className="w-24 text-right">Tax %</th>
              <th className="w-28 text-right">Tax</th>
              <th className="w-32 text-right">Total</th>
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
                          // Unit price defaults to the product sales price.
                          unitPrice: product ? product.salesPrice : line.unitPrice,
                        })
                      }
                      placeholder="Product"
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
                  <td className="text-right">{formatMoney(computed.tax)}</td>
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
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base">
            <dt className="font-bold text-slate-700">Total</dt>
            <dd className="font-bold text-slate-900">{formatMoney(record?.total ?? totals.total)}</dd>
          </div>
        </dl>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel sales order"
        message="The order moves to Cancelled. Any invoice created from it must be cancelled first."
        confirmLabel="Cancel order"
        onConfirm={() => void cancel()}
        onCancel={() => setConfirmCancel(false)}
      />
    </FormShell>
  );
}
