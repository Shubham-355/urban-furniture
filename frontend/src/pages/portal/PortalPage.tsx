import { useCallback, useEffect, useState } from 'react';
import { api, downloadFile, errorMessage, printPdf } from '../../lib/api';
import type { PortalDocument, PortalDocuments, PaymentVia } from '../../lib/types';
import { formatDate, formatMoney, today } from '../../lib/format';
import { useAuth } from '../../app/AuthContext';
import { useToast } from '../../app/ToastContext';
import {
  Avatar,
  EmptyState,
  Field,
  Logo,
  SelectInput,
  Spinner,
  StatusBadge,
  TextInput,
} from '../../components/ui';

interface PayTarget {
  kind: 'INVOICE' | 'BILL';
  document: PortalDocument;
}

/**
 * The contact portal. A CONTACT user sees only their own documents, with the
 * paid / unpaid status, a PDF download and a Pay button.
 */
export function PortalPage() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<PortalDocuments | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<PayTarget | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, date: today(), via: 'BANK' as PaymentVia });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<PortalDocuments>('/portal/documents');
      setData(response.data);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load your documents'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openPay = (kind: 'INVOICE' | 'BILL', document: PortalDocument) => {
    setTarget({ kind, document });
    setPayForm({ amount: document.amountDue, date: today(), via: 'BANK' });
  };

  const pay = async () => {
    if (!target) return;
    if (payForm.amount <= 0 || payForm.amount > target.document.amountDue) {
      toast.error(`Amount must be between 0 and ${formatMoney(target.document.amountDue)}`);
      return;
    }
    setBusy(true);
    try {
      await api.post('/portal/payments', {
        documentType: target.kind,
        documentId: target.document.id,
        amount: payForm.amount,
        date: payForm.date,
        via: payForm.via,
      });
      toast.success(`Payment recorded for ${target.document.number}`);
      setTarget(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not record the payment'));
    } finally {
      setBusy(false);
    }
  };

  const download = async (kind: 'INVOICE' | 'BILL', document: PortalDocument) => {
    try {
      await downloadFile(
        `/portal/documents/${kind.toLowerCase()}/${document.id}/pdf`,
        `${document.number.replace(/\//g, '-')}.pdf`,
      );
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download the PDF'));
    }
  };

  const print = async (kind: 'INVOICE' | 'BILL', document: PortalDocument) => {
    try {
      await printPdf(`/portal/documents/${kind.toLowerCase()}/${document.id}/pdf`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not open the print dialog'));
    }
  };

  const table = (title: string, kind: 'INVOICE' | 'BILL', documents: PortalDocument[]) => (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-slate-600">
        {title}
      </div>
      {documents.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Due Date</th>
                <th className="text-right">Total</th>
                <th className="text-right">Amount Due</th>
                <th>Status</th>
                <th className="w-72" />
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td className="font-semibold text-slate-900">{document.number}</td>
                  <td>{formatDate(document.date)}</td>
                  <td>{formatDate(document.dueDate)}</td>
                  <td className="text-right">{formatMoney(document.total)}</td>
                  <td className="text-right font-semibold">{formatMoney(document.amountDue)}</td>
                  <td>
                    <StatusBadge status={document.paymentStatus} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn-secondary px-2.5 py-1.5"
                        onClick={() => void print(kind, document)}
                      >
                        Print
                      </button>
                      <button
                        type="button"
                        className="btn-secondary px-2.5 py-1.5"
                        onClick={() => void download(kind, document)}
                      >
                        Download
                      </button>
                      {document.amountDue > 0 ? (
                        <button
                          type="button"
                          className="btn-primary px-2.5 py-1.5"
                          onClick={() => openPay(kind, document)}
                        >
                          Pay
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar name={user?.name ?? '?'} url={data?.contact.imageUrl} size={32} />
              <div className="leading-tight">
                <div className="text-xs font-bold text-slate-800">{user?.name}</div>
                <div className="text-[11px] text-slate-500">Contact portal</div>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void signOut().then(() => {
                  window.location.href = '/login';
                });
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {loading || !data ? (
          <Spinner label="Loading your documents..." />
        ) : (
          <>
            <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{data.contact.name}</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {data.contact.email}
                  {data.contact.mobile ? ` - ${data.contact.mobile}` : ''}
                </p>
              </div>
              <p className="max-w-sm text-sm text-slate-500">
                You can see your own invoices and bills here, download them and settle anything
                still due.
              </p>
            </div>

            <div className="space-y-5">
              {table('Invoices', 'INVOICE', data.invoices)}
              {data.bills.length > 0 ? table('Bills', 'BILL', data.bills) : null}
            </div>
          </>
        )}
      </main>

      {target ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Pay {target.document.number}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Amount due {formatMoney(target.document.amountDue)}
            </p>

            <div className="mt-4 space-y-4">
              <Field label="Amount (Rs.)">
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  max={target.document.amountDue}
                  value={payForm.amount}
                  onChange={(event) =>
                    setPayForm({ ...payForm, amount: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Date">
                <TextInput
                  type="date"
                  value={payForm.date}
                  onChange={(event) => setPayForm({ ...payForm, date: event.target.value })}
                />
              </Field>
              <Field label="Payment Via">
                <SelectInput
                  value={payForm.via}
                  onChange={(event) =>
                    setPayForm({ ...payForm, via: event.target.value as PaymentVia })
                  }
                >
                  <option value="BANK">Bank</option>
                  <option value="CASH">Cash</option>
                </SelectInput>
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void pay()}
              >
                {busy ? 'Paying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
