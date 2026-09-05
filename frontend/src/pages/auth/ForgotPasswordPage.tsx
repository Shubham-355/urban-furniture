import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import { Field, TextInput } from '../../components/ui';
import { AuthShell } from './AuthShell';

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ message: string; resetLink?: string; note?: string } | null>(
    null,
  );
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identifier.trim()) {
      setError('Enter your Login Id or email address');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post<{ message: string; resetLink?: string; note?: string }>(
        '/auth/forgot-password',
        { identifier: identifier.trim() },
      );
      setSent(data);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not start the password reset'));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email" footer={false}>
        <p className="text-sm text-slate-600">{sent.message}</p>
        {sent.resetLink ? (
          <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <p className="font-semibold">SMTP is not configured in this environment.</p>
            {sent.note ? <p className="mt-1 text-xs">{sent.note}</p> : null}
            <a href={sent.resetLink} className="mt-2 block break-all font-semibold underline">
              {sent.resetLink}
            </a>
          </div>
        ) : null}
        <Link to="/login" className="btn-secondary mt-5 w-full">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We will email you a link to set a new password."
      footer={false}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Login Id or Email Id" error={error}>
          <TextInput
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            error={Boolean(error)}
            placeholder="Login Id or Email Id"
          />
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Sending...' : 'SEND RESET LINK'}
        </button>
        <Link to="/login" className="btn-secondary w-full">
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
