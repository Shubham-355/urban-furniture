import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import type { AnalyticAccount, Contact, Product, PurchaseOrder } from '../../lib/types';
import { formatMoney, today, toDateInput } from '../../lib/format';
import { useRecord } from '../../hooks/useList';
import { useToast } from '../../app/ToastContext';
import { FormShell, SmartButton } from '../../components/shells';
import { ConfirmDialog, Field, Spinner, StatusBadge, TextInput } from '../../components/ui';
import { RecordPicker } from '../../components/RecordPicker';

interface DraftLine {
  key: string;
  productId: number | null;
  productName: string;
  analyticId: number | null;
  quantity: number;
  unitPrice: number;
}

const emptyLine = (): DraftLine => ({
  key: Math.random().toString(36).slice(2),
  productId: null,
  productName: '',
  analyticId: null,
  quantity: 1,
  unitPrice: 0,
});

export function PurchaseOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { record, loading, reload } = useRecord<PurchaseOrder>('/purchase-orders', id);

  const [header, setHeader] = useState({ vendorId: null as number | null, date: today() });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const editable = !record || record.status === 'DRAFT';

  useEffect(() => {
    if (!record) {
      setHeader({ vendorId: null, date: today() });
      setLines([emptyLine()]);
      return;
    }
    setHeader({ vendorId: record.vendorId, date: toDateInput(record.date) });
    setLines(
      record.lines.map((line) => ({
        key: String(line.id),
        productId: line.productId,
        productName: line.product.name,
        analyticId: line.analyticId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    );
  }, [record]);

  const total = useMemo(
    () =>
      Math.round(
        lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0) *
          100,
      ) / 100,
    [lines],
  );

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const save = async (): Promise<PurchaseOrder | null> => {
    const payload = {
      vendorId: header.vendorId,
      date: header.date,
      lines: lines
        .filter((line) => line.productId)
        .map((line) => ({
          productId: line.productId,
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
        const { data } = await api.put<PurchaseOrder>(`/purchase-orders/${record.id}`, payload);
        toast.success('Purchase order saved');
        await reload();
        return data;
      }
      const { data } = await api.post<PurchaseOrder>('/purchase-orders', payload);
      toast.success(`Purchase order ${data.number} created`);
      navigate(`/purchase/orders/${data.id}`, { replace: true });
      return data;
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the purchase order'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const confirmOrder = async () => {
    const saved = record ?? (await save());
    if (!saved) return;
    try {
      await api.post(`/purchase-orders/${saved.id}/confirm`);
      toast.success('Purchase order confirmed');
      navigate(`/purchase/orders/${saved.id}`, { replace: true });
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not confirm the purchase order'));
    }
  };

  const createBill = async () => {
    if (!record) return;
    try {
      const { data } = await api.post<{ id: number; number: string }>(
        `/purchase-orders/${record.id}/create-bill`,
      );
      toast.success(`Vendor bill ${data.number} created`);
      navigate(`/purchase/bills/${data.id}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the bill'));
    }
  };

  const cancel = async () => {
    setConfirmCancel(false);
    if (!record) {
      navigate('/purchase/orders');
      return;
    }
    try {
      await api.post(`/purchase-orders/${record.id}/cancel`);
      toast.success('Purchase order cancelled');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not cancel the purchase order'));
    }
  };

  if (loading) return <Spinner />;

  return (
    <FormShell
      title={record ? record.number : 'New Purchase Order'}
      subtitle="Confirming a purchase order creates no journal entry - the bill does that."
      status={record ? <StatusBadge status={record.status} /> : null}
      backTo="/purchase/orders"
      onNew={() => navigate('/purchase/orders/new')}
      onConfirm={editable ? () => void (record ? confirmOrder() : save()) : undefined}
      confirmLabel={record ? 'Confirm' : 'Save'}
      confirmDisabled={busy}
      smartButtons={
        record && record.bills.length > 0 ? (
          <SmartButton
            label="Bill"
            value={record.bills[0].number}
            onClick={() => navigate(`/purchase/bills/${record.bills[0].id}`)}
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
            <button type="button" className="btn-primary" onClick={() => void createBill()}>
              Create Bill
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
        <Field label="PO No.">
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
        <Field label="PO Date">
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
              <th className="min-w-[200px]">Product</th>
              <th className="min-w-[190px]">Budget Analytics</th>
              <th className="w-28 text-right">Qty</th>
              <th className="w-36 text-right">Unit Price</th>
              <th className="w-36 text-right">Total</th>
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
                        productName: product?.name ?? '',
                        // Unit price defaults to the product cost on a purchase.
                        unitPrice: product ? product.cost : line.unitPrice,
                      })
                    }
                    placeholder="Product"
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
          <tfoot>
            <tr className="bg-slate-50 font-bold">
              <td colSpan={5} className="px-3 py-2.5 text-right text-slate-600">
                Total
              </td>
              <td className="px-3 py-2.5 text-right">{formatMoney(total)}</td>
              {editable ? <td /> : null}
            </tr>
          </tfoot>
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

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel purchase order"
        message="The order moves to Cancelled. Any bill created from it must be cancelled first."
        confirmLabel="Cancel order"
        onConfirm={() => void cancel()}
        onCancel={() => setConfirmCancel(false)}
      />
    </FormShell>
  );
}
