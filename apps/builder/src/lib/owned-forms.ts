/**
 * Edit tokens for forms created in this browser, so "My forms" works without
 * accounts. Browser storage can be unavailable (private mode, blocked site
 * data), so every access is guarded; the edit link itself always works.
 */
const KEY = "formwise:owned-forms";

export type OwnedFormRef = { id: string; token: string; title: string; updatedAt: string };

export function listOwnedForms(): OwnedFormRef[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as OwnedFormRef[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  } catch {
    return [];
  }
}

export function rememberForm(ref: OwnedFormRef) {
  try {
    localStorage.setItem(KEY, JSON.stringify([ref, ...listOwnedForms().filter((f) => f.id !== ref.id)].slice(0, 50)));
  } catch {
    // Storage unavailable: nothing to do.
  }
}

export function forgetForm(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listOwnedForms().filter((f) => f.id !== id)));
  } catch {
    // Storage unavailable: nothing to do.
  }
}

export const tokenFor = (id: string) => listOwnedForms().find((f) => f.id === id)?.token;
