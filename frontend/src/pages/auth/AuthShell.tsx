import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/ui';

/** Shared frame for Login, Sign Up, Forgot Password and Reset Password. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: boolean;
}) {
  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          <div className="mt-5">{children}</div>
        </div>

        {footer ? (
          <div className="mt-4 text-center text-sm text-slate-500">
            <Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">
              Forgot Password
            </Link>
            <span className="px-2 text-slate-300">|</span>
            <Link to="/signup" className="font-semibold text-brand-700 hover:underline">
              Sign Up
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
