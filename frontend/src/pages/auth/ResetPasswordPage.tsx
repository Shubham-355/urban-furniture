import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import { resetPasswordSchema, validate } from '../../lib/validation';
import { Field, TextInput } from '../../components/ui';
import { useToast } from '../../app/ToastContext';
import { AuthShell } from './AuthShell';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate(resetPasswordSchema, form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, ...form });
      toast.success('Your password has been reset. Please sign in.');
      navigate('/login', { replace: true });
    } catch (error) {
      setErrors({ form: errorMessage(error, 'Could not reset the password') });
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Reset password" footer={false}>
        <p className="text-sm text-slate-600">
          This reset link is missing its token. Request a new one from the Forgot Password page.
        </p>
        <Link to="/forgot-password" className="btn-primary mt-5 w-full">
          Forgot Password
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" footer={false}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {errors.form}
          </div>
        ) : null}

        <Field
          label="Password"
          error={errors.password}
          hint="More than 8 characters with an uppercase, a lowercase and a special character"
        >
          <TextInput
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            error={Boolean(errors.password)}
            autoComplete="new-password"
          />
        </Field>

        <Field label="Re-Enter Password" error={errors.confirmPassword}>
          <TextInput
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
            error={Boolean(errors.confirmPassword)}
            autoComplete="new-password"
          />
        </Field>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving...' : 'RESET PASSWORD'}
        </button>
      </form>
    </AuthShell>
  );
}
