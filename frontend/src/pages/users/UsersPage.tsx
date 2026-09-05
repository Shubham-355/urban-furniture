import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import type { AppUser, Contact, Role } from '../../lib/types';
import { createUserSchema, validate } from '../../lib/validation';
import { formatDate, titleCase } from '../../lib/format';
import { useList } from '../../hooks/useList';
import { useToast } from '../../app/ToastContext';
import { FormShell, ListShell } from '../../components/shells';
import { EmptyState, Field, Spinner, StatusBadge, TextInput } from '../../components/ui';
import { RecordPicker } from '../../components/RecordPicker';

export function UsersPage() {
  const navigate = useNavigate();
  const list = useList<AppUser>('/users', { pageSize: 25 });

  return (
    <ListShell
      title="Users"
      subtitle="Administrators, invoicing users and contact portal logins."
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search name, login id or email"
      onNew={() => navigate('/users/new')}
      newLabel="Create User"
      archived={list.params.archived}
      onArchived={list.setArchived}
      filters={
        <select
          className="input w-auto py-2"
          value={list.params.status ?? ''}
          onChange={(event) => list.setStatus(event.target.value || undefined)}
          aria-label="Role filter"
        >
          <option value="">All roles</option>
          <option value="ADMIN">Administrator</option>
          <option value="ACCOUNTANT">Accountant</option>
          <option value="CONTACT">Contact</option>
        </select>
      }
      page={list.params.page}
      pageCount={list.pageCount}
      total={list.total}
      onPage={list.setPage}
    >
      {list.loading ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState title="No users" hint="Use Create User to add one." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Login Id</th>
                <th>E-mail id</th>
                <th>Role</th>
                <th>Linked contact</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((user) => (
                <tr key={user.id}>
                  <td className="font-semibold text-slate-900">
                    {user.name}
                    {user.isArchived ? (
                      <span className="ml-2 text-xs font-medium text-rose-600">Archived</span>
                    ) : null}
                  </td>
                  <td>{user.loginId}</td>
                  <td>{user.email}</td>
                  <td>
                    <StatusBadge status={titleCase(user.role)} />
                  </td>
                  <td>{user.contact?.name ?? '-'}</td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ListShell>
  );
}

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: 'CONTACT', label: 'User', hint: 'Contact portal login, sees only their own documents' },
  { value: 'ADMIN', label: 'Administrator', hint: 'Full access including archiving and user management' },
  { value: 'ACCOUNTANT', label: 'Accountant', hint: 'Invoicing user: masters, documents and reports' },
];

export function CreateUserPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    loginId: '',
    password: '',
    confirmPassword: '',
    role: 'ACCOUNTANT' as Role,
    contactId: null as number | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const result = validate(createUserSchema, form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { data } = await api.post<{ mail?: { delivered: boolean; reason?: string } }>(
        '/users',
        form,
      );
      toast.success(`${form.name} can now sign in as ${titleCase(form.role)}`);
      // The credentials mail is best effort: say plainly when it did not go out.
      if (data.mail?.delivered) {
        toast.info(`Sign in details emailed to ${form.email}`);
      } else if (data.mail) {
        toast.info(`Account created, but no email was sent. ${data.mail.reason ?? ''}`.trim());
      }
      navigate('/users');
    } catch (error) {
      setErrors({ form: errorMessage(error, 'Could not create the user') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell
      title="Create User"
      subtitle="Only an administrator can create users."
      backTo="/users"
      actions={
        <>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? 'Creating...' : 'Create'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/users')}>
            Cancel
          </button>
        </>
      }
    >
      {errors.form ? (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {errors.form}
        </div>
      ) : null}

      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <TextInput
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            error={Boolean(errors.name)}
          />
        </Field>
        <Field label="E-mail id" error={errors.email}>
          <TextInput
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            error={Boolean(errors.email)}
          />
        </Field>
        <Field label="Login id" error={errors.loginId} hint="6 to 12 characters, must be unique">
          <TextInput
            value={form.loginId}
            onChange={(event) => setForm({ ...form, loginId: event.target.value })}
            error={Boolean(errors.loginId)}
          />
        </Field>
        <div />
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
      </div>

      <fieldset className="mt-6">
        <legend className="field">Role</legend>
        <div className="grid max-w-3xl gap-2 sm:grid-cols-3">
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-lg border p-3 transition ${
                form.role === option.value
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold text-slate-800">
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={form.role === option.value}
                  onChange={() => setForm({ ...form, role: option.value })}
                />
                {option.label}
              </span>
              <span className="mt-1 block text-xs text-slate-500">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {form.role === 'CONTACT' ? (
        <div className="mt-5 max-w-md">
          <Field label="Contact" error={errors.contactId}>
            <RecordPicker<Contact>
              endpoint="/contacts"
              params={{ portal: 'none' }}
              value={form.contactId}
              onChange={(contactId) => setForm({ ...form, contactId })}
              placeholder="Which contact is this login for?"
              emptyLabel="Every contact already has a portal login"
              error={Boolean(errors.contactId)}
            />
          </Field>
        </div>
      ) : null}
    </FormShell>
  );
}
