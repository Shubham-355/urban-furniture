import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadFile, errorMessage, printPdf } from '../../lib/api';
import { useToast } from '../../app/ToastContext';
import { Field, TextInput } from '../../components/ui';

export interface Period {
  from: string;
  to: string;
}

/** Financial year running 1 April - 31 March, the Indian convention. */
export function financialYear(offset = 0): Period {
  const now = new Date();
  const startYear = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) + offset;
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    from: `${startYear}-04-01`,
    to: `${startYear + 1}-03-${pad(31)}`,
  };
}

/**
 * Shared frame for the three reports: a period selector, a Print button that
 * downloads the server rendered PDF, and Back.
 */
export function ReportShell({
  title,
  subtitle,
  period,
  onPeriodChange,
  pdfUrl,
  pdfName,
  extraActions,
  children,
}: {
  title: string;
  subtitle?: string;
  period: Period;
  onPeriodChange: (period: Period) => void;
  pdfUrl: string;
  pdfName: string;
  extraActions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<'print' | 'download' | null>(null);

  // Print opens the browser print dialog; Download saves the same PDF.
  const print = async () => {
    setBusy('print');
    try {
      await printPdf(pdfUrl);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not open the print dialog'));
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy('download');
    try {
      await downloadFile(pdfUrl, pdfName);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download the PDF'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extraActions}
          <button
            type="button"
            className="btn-primary"
            disabled={busy !== null}
            onClick={() => void print()}
          >
            {busy === 'print' ? 'Preparing...' : 'Print'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => void download()}
          >
            {busy === 'download' ? 'Preparing...' : 'Download'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="From" className="w-44">
          <TextInput
            type="date"
            value={period.from}
            onChange={(event) => onPeriodChange({ ...period, from: event.target.value })}
          />
        </Field>
        <Field label="To" className="w-44">
          <TextInput
            type="date"
            value={period.to}
            onChange={(event) => onPeriodChange({ ...period, to: event.target.value })}
          />
        </Field>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onPeriodChange(financialYear())}
        >
          This financial year
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onPeriodChange(financialYear(-1))}
        >
          Last financial year
        </button>
      </div>

      {children}
    </div>
  );
}
