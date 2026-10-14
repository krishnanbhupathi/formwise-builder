# Lighthouse 2026-10-14

Lighthouse 12.8.2, headless Chrome, median of 3 runs per row, measured from the author's machine (India) against production. Mobile = Lighthouse's default throttled mobile profile.

| Page | Form factor | Perf | A11y | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| builder | mobile | 100 | 100 | 100 | 92 | 1.5 s | 6 ms | 0.000 |
| builder | desktop | 100 | 100 | 100 | 92 | 0.4 s | 0 ms | 0.000 |
| public-form | mobile | 100 | 100 | 100 | 91 | 1.5 s | 0 ms | 0.022 |
| public-form | desktop | 100 | 100 | 100 | 91 | 0.4 s | 0 ms | 0.006 |

- builder: https://formwise-builder.vercel.app/
- public-form: https://formwise-builder.vercel.app/f/jmdpq5gycd
