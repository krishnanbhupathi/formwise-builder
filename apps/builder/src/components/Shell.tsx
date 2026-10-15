import type { ReactNode } from "react";
import { linkProps } from "../lib/router";
import { buttonLook } from "./button-look";

/** The Formwise mark: a printed field box with its label filled in. */
export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <rect x="3" y="3" width="12" height="7" fill="currentColor" />
      <path d="M8 18h16M8 23.5h10" stroke="var(--ledger)" strokeWidth="3" />
    </svg>
  );
}

/**
 * App chrome: logo, "My forms", an optional form number, and page-specific actions on the right.
 * On phones the primary action stays on the logo row and the other actions get one row of
 * their own that scrolls sideways if it has to, so the header is at most two rows.
 */
export function Shell({ actions, primary, docLabel, children }: { actions?: ReactNode; primary?: ReactNode; docLabel?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b-2 border-ink bg-panel px-4 py-2.5">
        <a {...linkProps("/")} className="flex items-center gap-2 text-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2">
          <Logo />
          {/* The editor needs the logo row for its primary actions on phones; the mark alone carries the brand there. */}
          <span className={`text-xl font-black tracking-[-0.03em] ${primary ? "max-sm:sr-only" : ""}`}>Formwise</span>
        </a>
        <a {...linkProps("/forms")} className="px-1 text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2">
          My forms
        </a>
        {docLabel && <span className="label-mono hidden text-muted md:inline">{docLabel}</span>}
        {primary && <div className="order-1 ml-auto flex items-center gap-2 md:order-3 md:ml-0">{primary}</div>}
        {actions && (
          <div className="order-2 -mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:ml-auto md:w-auto md:overflow-visible md:p-0 [&>*]:shrink-0">
            {actions}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}


export function Button({
  children,
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return (
    <button type="button" {...props} className={`${buttonLook[variant]} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">{children}</main>;
}
