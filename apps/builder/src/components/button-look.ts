/** Button classes, shared by <Button> and links styled as buttons. */
const BUTTON = "inline-flex h-9 items-center gap-1.5 border-[1.5px] px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed";
export const buttonLook = {
  primary: `${BUTTON} fw-press border-accent-dark bg-accent text-white hover:bg-accent-dark disabled:bg-accent/60 disabled:shadow-none`,
  secondary: `${BUTTON} border-ink bg-panel text-ink hover:bg-band disabled:opacity-50`,
};
