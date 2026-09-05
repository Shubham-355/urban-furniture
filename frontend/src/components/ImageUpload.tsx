import { useRef, useState } from 'react';
import { errorMessage, uploadImage } from '../lib/api';
import { useToast } from '../app/ToastContext';
import { Avatar } from './ui';

/** Upload Image control used by the Contact and Product forms. */
export function ImageUpload({
  value,
  onChange,
  name,
  label = 'Upload Image',
  disabled = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  name: string;
  label?: string;
  disabled?: boolean;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(file));
      toast.success('Image uploaded');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not upload the image'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name || '?'} url={value} size={64} />
      <div className="flex flex-col gap-1.5">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => void pick(event.target.files?.[0])}
        />
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          {busy ? 'Uploading...' : label}
        </button>
        {value ? (
          <button
            type="button"
            className="text-xs font-semibold text-rose-600 hover:underline"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Remove image
          </button>
        ) : (
          <span className="text-xs text-slate-400">PNG, JPEG, WEBP or GIF up to 4 MB</span>
        )}
      </div>
    </div>
  );
}
