import type { ReactNode } from "react";
import { linkProps } from "../lib/router";

/** App chrome: logo, "My forms", and page-specific actions on the right. */
export function Shell({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-2.5">
        <a {...linkProps("/")} className="flex items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-accent">
          <img src="/favicon.svg" alt="" className="size-7" />
          <span className="text-base font-semibold">Formwise</span>
        </a>
        <a {...linkProps("/forms")} className="rounded px-1 text-sm text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
          My forms
        </a>
        <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
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
  const look =
    variant === "primary"
      ? "bg-accent text-white dark:text-slate-950 hover:opacity-90"
      : "border border-line bg-panel text-ink hover:border-accent";
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${look} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">{children}</main>;
}
