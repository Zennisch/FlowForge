'use client';

export function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <rect x="8" y="14" width="48" height="36" rx="8" fill="rgba(37,99,235,0.16)" />
      <rect x="8" y="14" width="48" height="36" rx="8" stroke="#3B82F6" strokeWidth="2" />
      <path d="M12 20 32 35 52 20" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="18" r="7" fill="#0EA5E9" />
      <path d="M45 18h6M48 15v6" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
