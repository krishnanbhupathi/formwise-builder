import { useSyncExternalStore } from "react";

/** A four-route app doesn't need a router library: pathname + pushState. */
export type Route =
  | { name: "new" }
  | { name: "forms" }
  | { name: "edit"; id: string }
  | { name: "submissions"; id: string }
  | { name: "fill"; id: string }
  | { name: "notFound" };

export function parseRoute(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean);
  const [a, b, c] = parts;
  if (parts.length === 0) return { name: "new" };
  if (a === "forms" && parts.length === 1) return { name: "forms" };
  if (a === "edit" && b && parts.length === 2) return { name: "edit", id: b };
  if (a === "edit" && b && c === "submissions" && parts.length === 3) return { name: "submissions", id: b };
  if (a === "f" && b && parts.length === 2) return { name: "fill", id: b };
  return { name: "notFound" };
}

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("popstate", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("popstate", fn);
  };
};

export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  listeners.forEach((fn) => fn());
  window.scrollTo(0, 0);
}

export const usePathname = () => useSyncExternalStore(subscribe, () => location.pathname);

/** Same-origin links without a full page load (modifier-clicks still open new tabs). */
export function linkProps(to: string) {
  return {
    href: to,
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to);
    },
  };
}
