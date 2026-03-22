import { redirect } from 'next/navigation';

export default function AuthResetPasswordAliasPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') {
      query.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    }
  }

  const queryString = query.toString();
  redirect(queryString ? `/reset-password?${queryString}` : '/reset-password');
}
