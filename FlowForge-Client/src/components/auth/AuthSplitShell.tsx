'use client';

import { ReactNode } from 'react';

import { FlowForgeLogo } from './FlowForgeLogo';

type AuthSplitShellProps = {
  children: ReactNode;
};

export function AuthSplitShell({ children }: AuthSplitShellProps) {
  return (
    <div className="dark min-h-screen bg-[#09090B] text-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[5fr_5fr]">
        <aside className="ff-auth-brand-panel ff-auth-fade-in relative hidden overflow-hidden border-r border-white/10 lg:flex">
          <div className="ff-auth-grid" aria-hidden="true" />
          <div className="ff-auth-glow ff-auth-glow-one" aria-hidden="true" />
          <div className="ff-auth-glow ff-auth-glow-two" aria-hidden="true" />

          <div className="relative z-10 flex min-h-screen w-full flex-col px-10 py-10 xl:px-14">
            <FlowForgeLogo className="self-start" />

            <div className="my-auto max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
                The Event-Driven Workflow Engine
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
                Automate at the speed of thought.
              </h1>
              <p className="mt-5 max-w-lg text-base text-slate-300">
                Build resilient workflows, orchestrate asynchronous events, and monitor every step in
                real time.
              </p>
            </div>

            <p className="text-sm text-slate-400">Powering millions of asynchronous tasks daily.</p>
          </div>
        </aside>

        <section className="ff-auth-form-panel ff-auth-slide-in-right relative flex min-h-screen items-center justify-center bg-[#18181B] px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <FlowForgeLogo compact />
            </div>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
