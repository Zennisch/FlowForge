'use client';

import { twMerge } from 'tailwind-merge';

export const cn = (...parts: Array<string | false | undefined>) =>
  twMerge(parts.filter(Boolean).join(' '));
