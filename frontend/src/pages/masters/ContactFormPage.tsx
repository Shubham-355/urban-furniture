import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import type { Contact, ContactType } from '../../lib/types';
import { contactSchema, loginIdSchema, passwordSchema, validate } from '../../lib/validation';
import { useRecord } from '../../hooks/useList';
import { useAuth } from '../../app/AuthContext';
import { useToast } from '../../app/ToastContext';
import { FormShell } from '../../components/shells';
import { ConfirmDialog, Field, SelectInput, Spinner, StatusBadge, TextInput } from '../../components/ui';
import { ImageUpload } from '../../components/ImageUpload';
import { titleCase } from '../../lib/format';

const EMPTY = {
  name: '',
  type: 'CUSTOMER' as ContactType,
  email: '',
  mobile: '',
  street: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  imageUrl: null as string | null,
};

export function ContactFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { record, loading, reload } = useRecord<Contact>('/contacts', id);

  const [form, setForm] = useState(EMPTY);
  const [portal, setPortal] = useState({ enabled: false, loginId: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!record) {
      setForm(EMPTY);
      setPortal({ enabled: false, loginId: '', password: '' });
      return;
    }
    setForm({
      name: record.name,
      type: record.type,
      email: record.email,
      mobile: record.mobile ?? '',
      street: record.street ?? '',
      city: record.city ?? '',
      state: record.state ?? '',
      country: record.country ?? 'India',
      pincode: record.pincode ?? '',
      imageUrl: record.imageUrl,
    });
    setPortal({ enabled: false, loginId: '', password: '' });
  }, [record]);

  const save = async () => {
    const base = validate(contactSchema, {
      name: form.name,
      email: form.email,
      type: form.type,
    });
    const nextErrors: Record<string, string> = base.ok ? {} : base.errors;

    if (portal.enabled && !record?.portalUser) {
      const loginResult = loginIdSchema.safeParse(portal.loginId);
      if (!loginResult.success) nextErrors.portalLoginId = loginResult.error.issues[0].message;
      const passwordResult = passwordSchema.safeParse(portal.password);
      if (!passwordResult.success) nextErrors.portalPassword = passwordResult.error.issues[0].message;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setBusy(true);

    const payload = {
      ...form,
      mobile: form.mobile || null,
      street: form.street || null,
      city: form.city || null,
      state: form.state || null,
      country: form.country || null,
      pincode: form.pincode || null,
      portalUser:
        portal.enabled && !record?.portalUser
          ? { loginId: portal.loginId.trim(), password: portal.password }
          : null,
    };

    try {
      type Saved = Contact & { mail?: { delivered: boolean; reason?: string } };
      const announceMail = (mail?: { delivered: boolean; reason?: string }) => {
        if (!mail) return;
        if (mail.delivered) toast.info(`Sign in details emailed to ${payload.email}`);
        else toast.info(`Portal login created, but no email was sent. ${mail.reason ?? ''}`.trim());
      };

      if (record) {
        const { data } = await api.put<Saved>(`/contacts/${record.id}`, payload);
        toast.success('Contact saved');
        announceMail(data.mail);
        await reload();
      } else {
        const { data } = await api.post<Saved>('/contacts', payload);
        toast.success('Contact created');
        announceMail(data.mail);
        navigate(`/account/contacts/${data.id}`, { replace: true });
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the contact'));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!record) return;
    setConfirmArchive(false);
    try {
      await api.post(`/contacts/${record.id}/${record.isArchived ? 'restore' : 'archive'}`);
      toast.success(record.isArchived ? 'Contact restored' : 'Contact archived');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not archive the contact'));
    }
  };

  if (loading) return <Spinner />;

  return (
    <FormShell
      title={record ? record.name : 'New Contact'}
      subtitle={record ? record.email : 'Create a customer, a vendor or both.'}
      status={record ? <StatusBadge status={titleCase(record.type)} /> : null}
      backTo="/account/contacts"
      onNew={() => navigate('/account/contacts/new')}
      onConfirm={() => void save()}
      confirmDisabled={busy}
      onArchive={isAdmin && record ? () => setConfirmArchive(true) : undefined}
      archiveLabel={record?.isArchived ? 'Restore' : 'Archived'}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact Name" error={errors.name}>
              <TextInput
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                error={Boolean(errors.name)}
                placeholder="Contact Name"
              />
            </Field>
            <Field label="Type" error={errors.type}>
              <SelectInput
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as ContactType })}
              >
                <option value="CUSTOMER">Customer</option>
                <option value="VENDOR">Vendor</option>
                <option value="BOTH">Both</option>
              </SelectInput>
            </Field>
            <Field label="Email" error={errors.email}>
              <TextInput
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                error={Boolean(errors.email)}
                placeholder="name@example.com"
              />
            </Field>
            <Field label="Phone">
              <TextInput
                value={form.mobile}
                onChange={(event) => setForm({ ...form, mobile: event.target.value })}
                placeholder="Phone"
              />
            </Field>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Street" className="sm:col-span-2">
                <TextInput
                  value={form.street}
                  onChange={(event) => setForm({ ...form, street: event.target.value })}
                />
              </Field>
              <Field label="City">
                <TextInput
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                />
              </Field>
              <Field label="State">
                <TextInput
                  value={form.state}
                  onChange={(event) => setForm({ ...form, state: event.target.value })}
                />
              </Field>
              <Field label="Country">
                <TextInput
                  value={form.country}
                  onChange={(event) => setForm({ ...form, country: event.target.value })}
                />
              </Field>
              <Field label="Pincode">
                <TextInput
                  value={form.pincode}
                  onChange={(event) => setForm({ ...form, pincode: event.target.value })}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <span className="field">Upload Image</span>
            <ImageUpload
              name={form.name}
              value={form.imageUrl}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
            />
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-bold text-slate-800">Portal user</h2>
            {record?.portalUser ? (
              <p className="mt-1.5 text-sm text-slate-600">
                This contact signs in with <strong>{record.portalUser.loginId}</strong> and can see
                only their own invoices and bills.
              </p>
            ) : (
              <>
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={portal.enabled}
                    onChange={(event) => setPortal({ ...portal, enabled: event.target.checked })}
                  />
                  Create portal user
                </label>
                {portal.enabled ? (
                  <div className="mt-3 space-y-3">
                    <Field label="Login Id" error={errors.portalLoginId}>
                      <TextInput
                        value={portal.loginId}
                        onChange={(event) => setPortal({ ...portal, loginId: event.target.value })}
                        error={Boolean(errors.portalLoginId)}
                        placeholder="6 to 12 characters"
                      />
                    </Field>
                    <Field label="Password" error={errors.portalPassword}>
                      <TextInput
                        type="password"
                        value={portal.password}
                        onChange={(event) => setPortal({ ...portal, password: event.target.value })}
                        error={Boolean(errors.portalPassword)}
                      />
                    </Field>
                    <p className="text-xs text-slate-500">
                      The portal login uses this contact&apos;s email address.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title={record?.isArchived ? 'Restore contact' : 'Archive contact'}
        message={
          record?.isArchived
            ? 'The contact will be selectable again on new documents.'
            : 'Archived contacts stay on existing documents but are hidden from the pickers.'
        }
        confirmLabel={record?.isArchived ? 'Restore' : 'Archive'}
        onConfirm={() => void archive()}
        onCancel={() => setConfirmArchive(false)}
      />
    </FormShell>
  );
}
