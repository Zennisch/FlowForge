'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

import ZText from '@/components/primary/ZText';

type FooterLink = {
  text: string;
  linkText: string;
  href: string;
};

type AuthFormCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footerLinks?: FooterLink[];
};

export function AuthFormCard({ title, subtitle, children, footerLinks = [] }: AuthFormCardProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#18181B]/90 p-6 shadow-[0_24px_60px_-28px_rgba(2,132,199,0.46)] backdrop-blur sm:p-7">
      <header>
        <ZText
          as="h1"
          variant="heading"
          size="sm"
          weight="semibold"
          className="tracking-tight text-slate-50"
        >
          {title}
        </ZText>
        <ZText as="p" size="sm" color="secondary" className="mt-2 text-slate-400">
          {subtitle}
        </ZText>
      </header>

      <div className="mt-6">{children}</div>

      {footerLinks.length > 0 ? (
        <footer className="mt-6 space-y-2 text-center">
          {footerLinks.map((item) => (
            <p key={`${item.href}-${item.linkText}`} className="text-sm text-slate-400">
              {item.text}{' '}
              <Link className="font-medium text-(--color-primary) hover:underline" href={item.href}>
                {item.linkText}
              </Link>
            </p>
          ))}
        </footer>
      ) : null}
    </section>
  );
}
