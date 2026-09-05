import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../../app/AuthContext';
import { errorMessage } from '../../lib/api';
import { loginSchema, validate } from '../../lib/validation';
import { Field, TextInput } from '../../components/ui';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ loginId: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate(loginSchema, form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const user = await signIn(form.loginId.trim(), form.password);
      navigate(homeFor(user), { replace: true });
    } catch (error) {
      // The server answers with exactly "Invalid Login Id or Password".
      setErrors({ form: errorMessage(error, 'Invalid Login Id or Password') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Use your Urban Furniture credentials.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {errors.form}
          </div>
        ) : null}

        <Field label="Login Id" error={errors.loginId}>
          <TextInput
            value={form.loginId}
            onChange={(event) => setForm({ ...form, loginId: event.target.value })}
            error={Boolean(errors.loginId)}
            autoComplete="username"
            placeholder="Login Id"
          />
        </Field>

        <Field label="Password" error={errors.password}>
          <TextInput
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            error={Boolean(errors.password)}
            autoComplete="current-password"
            placeholder="Password"
          />
        </Field>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in...' : 'SIGN IN'}
        </button>
      </form>
    </AuthShell>
  );
}
