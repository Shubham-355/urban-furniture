import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../../app/AuthContext';
import { errorMessage } from '../../lib/api';
import { signupSchema, validate } from '../../lib/validation';
import { Field, TextInput } from '../../components/ui';
import { useToast } from '../../app/ToastContext';
import { AuthShell } from './AuthShell';

const EMPTY = { name: '', loginId: '', email: '', password: '', confirmPassword: '' };

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate(signupSchema, form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      // Public sign up always creates an Invoicing User (Accountant).
      const user = await signUp(result.data);
      toast.success('Account created. Welcome to Urban Furniture.');
      navigate(homeFor(user), { replace: true });
    } catch (error) {
      setErrors({ form: errorMessage(error, 'Could not create the account') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Sign up"
      subtitle="Creates an Invoicing User account for the accounting workspace."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {errors.form}
          </div>
        ) : null}

        <Field label="Name" error={errors.name}>
          <TextInput
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            error={Boolean(errors.name)}
            placeholder="Name"
          />
        </Field>

        <Field label="Enter Login Id" error={errors.loginId} hint="6 to 12 characters, must be unique">
          <TextInput
            value={form.loginId}
            onChange={(event) => setForm({ ...form, loginId: event.target.value })}
            error={Boolean(errors.loginId)}
            autoComplete="username"
            placeholder="Login Id"
          />
        </Field>

        <Field label="Enter Email Id" error={errors.email}>
          <TextInput
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            error={Boolean(errors.email)}
            autoComplete="email"
            placeholder="Email Id"
          />
        </Field>

        <Field
          label="Enter Password"
          error={errors.password}
          hint="More than 8 characters with an uppercase, a lowercase and a special character"
        >
          <TextInput
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            error={Boolean(errors.password)}
            autoComplete="new-password"
            placeholder="Password"
          />
        </Field>

        <Field label="Re-Enter Password" error={errors.confirmPassword}>
          <TextInput
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
            error={Boolean(errors.confirmPassword)}
            autoComplete="new-password"
            placeholder="Re-Enter Password"
          />
        </Field>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating account...' : 'SIGN UP'}
        </button>
      </form>
    </AuthShell>
  );
}
