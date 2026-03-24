'use client';

import { ChangeEvent, ReactNode, useId, useState } from 'react';

import ZText from '@/components/primary/ZText';
import ZTextInput from '@/components/primary/ZTextInput';

type AuthPasswordFieldProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  minLength?: number;
  required?: boolean;
  labelAction?: ReactNode;
};

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.67 10s3.05-5 8.33-5c5.27 0 8.33 5 8.33 5s-3.06 5-8.33 5c-5.28 0-8.33-5-8.33-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="2.7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.67 10s3.05-5 8.33-5c5.27 0 8.33 5 8.33 5s-3.06 5-8.33 5c-5.28 0-8.33-5-8.33-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="2.7" stroke="currentColor" strokeWidth="1.5" />
      <path d="m3 17 14-14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function AuthPasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  minLength = 8,
  required = true,
  labelAction,
}: AuthPasswordFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <ZText as="label" htmlFor={fieldId} variant="label" size="sm" className="text-slate-200">
          {label}
        </ZText>
        {labelAction}
      </div>
      <ZTextInput
        id={fieldId}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        size="md"
        fullWidth
        className="text-slate-100"
        iconEnd={
          <button
            type="button"
            onClick={() => setShowPassword((previous) => !previous)}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        }
      />
    </div>
  );
}
