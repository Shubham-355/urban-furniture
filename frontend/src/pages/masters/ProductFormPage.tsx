import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import type { Product, ProductCategory, ProductType } from '../../lib/types';
import { productSchema, validate } from '../../lib/validation';
import { useRecord } from '../../hooks/useList';
import { useAuth } from '../../app/AuthContext';
import { useToast } from '../../app/ToastContext';
import { FormShell } from '../../components/shells';
import { ConfirmDialog, Field, SelectInput, Spinner, TextInput } from '../../components/ui';
import { ImageUpload } from '../../components/ImageUpload';
import { RecordPicker } from '../../components/RecordPicker';

const EMPTY = {
  name: '',
  type: 'GOODS' as ProductType,
  categoryId: null as number | null,
  salesPrice: 0,
  cost: 0,
  imageUrl: null as string | null,
};

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { record, loading, reload } = useRecord<Product>('/products', id);

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!record) {
      setForm(EMPTY);
      return;
    }
    setForm({
      name: record.name,
      type: record.type,
      categoryId: record.categoryId,
      salesPrice: record.salesPrice,
      cost: record.cost,
      imageUrl: record.imageUrl,
    });
  }, [record]);

  const save = async () => {
    const result = validate(productSchema, {
      name: form.name,
      salesPrice: form.salesPrice,
      cost: form.cost,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (record) {
        await api.put(`/products/${record.id}`, form);
        toast.success('Product saved');
        await reload();
      } else {
        const { data } = await api.post<Product>('/products', form);
        toast.success('Product created');
        navigate(`/account/products/${data.id}`, { replace: true });
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the product'));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!record) return;
    setConfirmArchive(false);
    try {
      await api.post(`/products/${record.id}/${record.isArchived ? 'restore' : 'archive'}`);
      toast.success(record.isArchived ? 'Product restored' : 'Product archived');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not archive the product'));
    }
  };

  if (loading) return <Spinner />;

  return (
    <FormShell
      title={record ? record.name : 'New Product'}
      subtitle={record ? (record.category?.name ?? 'Uncategorised') : 'Add a product to sell or buy.'}
      backTo="/account/products"
      onNew={() => navigate('/account/products/new')}
      onConfirm={() => void save()}
      confirmDisabled={busy}
      onArchive={isAdmin && record ? () => setConfirmArchive(true) : undefined}
      archiveLabel={record?.isArchived ? 'Restore' : 'Archived'}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <Field label="Product Name" error={errors.name}>
            <TextInput
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              error={Boolean(errors.name)}
              placeholder="Product Name"
            />
          </Field>

          <Field label="Product Type">
            <SelectInput
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as ProductType })}
            >
              <option value="GOODS">Goods</option>
              <option value="SERVICE">Service</option>
              <option value="COMBO">Combo</option>
            </SelectInput>
          </Field>

          <Field label="Category" hint="Type a new name to create a category on the fly">
            <RecordPicker<ProductCategory>
              endpoint="/product-categories"
              value={form.categoryId}
              onChange={(categoryId) => setForm({ ...form, categoryId })}
              placeholder="Select a category"
              allowCreate
            />
          </Field>

          <div />

          <Field label="Sales Price (Rs.)" error={errors.salesPrice}>
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={form.salesPrice}
              onChange={(event) => setForm({ ...form, salesPrice: Number(event.target.value) })}
              error={Boolean(errors.salesPrice)}
            />
          </Field>

          <Field label="Cost / Purchase Price (Rs.)" error={errors.cost}>
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={form.cost}
              onChange={(event) => setForm({ ...form, cost: Number(event.target.value) })}
              error={Boolean(errors.cost)}
            />
          </Field>
        </div>

        <div>
          <span className="field">Upload Image</span>
          <ImageUpload
            name={form.name}
            value={form.imageUrl}
            onChange={(url) => setForm({ ...form, imageUrl: url })}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title={record?.isArchived ? 'Restore product' : 'Archive product'}
        message={
          record?.isArchived
            ? 'The product will be selectable again on new documents.'
            : 'Archived products stay on existing documents but are hidden from the pickers.'
        }
        confirmLabel={record?.isArchived ? 'Restore' : 'Archive'}
        onConfirm={() => void archive()}
        onCancel={() => setConfirmArchive(false)}
      />
    </FormShell>
  );
}
