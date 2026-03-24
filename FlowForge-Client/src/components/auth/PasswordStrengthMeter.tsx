'use client';

import { useMemo } from 'react';

import { cn } from '@/components/primary/utils';

type PasswordStrengthMeterProps = {
  password: string;
};

type Strength = {
  label: 'Weak' | 'Medium' | 'Strong';
  value: number;
  colorClass: string;
  textClass: string;
};

function getStrength(password: string): Strength {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (hasLower && hasUpper) score += 1;
  if (hasNumber) score += 1;
  if (hasSpecial) score += 1;

  if (score <= 2) {
    return {
      label: 'Weak',
      value: 33,
      colorClass: 'bg-rose-500',
      textClass: 'text-rose-400',
    };
  }

  if (score <= 4) {
    return {
      label: 'Medium',
      value: 66,
      colorClass: 'bg-amber-500',
      textClass: 'text-amber-400',
    };
  }

  return {
    label: 'Strong',
    value: 100,
    colorClass: 'bg-emerald-500',
    textClass: 'text-emerald-400',
  };
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = useMemo(() => getStrength(password), [password]);

  if (!password) {
    return null;
  }

  return (
    <div className="mt-2" aria-live="polite">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className={cn('h-full rounded-full transition-all duration-300', strength.colorClass)}
          style={{ width: `${strength.value}%` }}
        />
      </div>
      <p className={cn('mt-1 text-xs font-medium', strength.textClass)}>
        Password strength: {strength.label}
      </p>
    </div>
  );
}
