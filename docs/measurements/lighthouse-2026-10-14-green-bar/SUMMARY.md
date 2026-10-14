# Lighthouse 2026-10-14 (after the green-bar restyle, commit adfe22d)

Lighthouse 12.8.2, headless Chrome, median of 3 runs per row, measured from the author's machine (India) against production. Mobile = Lighthouse's default throttled mobile profile.

| Page | Form factor | Perf | A11y | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| builder | mobile | 98 | 100 | 100 | 100 | 1.8 s | 3 ms | 0.000 |
| builder | desktop | 100 | 100 | 100 | 100 | 0.4 s | 0 ms | 0.000 |
| public-form | mobile | 99 | 100 | 100 | 63 | 1.8 s | 0 ms | 0.022 |
| public-form | desktop | 100 | 100 | 100 | 63 | 0.4 s | 0 ms | 0.006 |

- builder: https://formwise-builder.vercel.app/
- public-form: https://formwise-builder.vercel.app/f/jmdpq5gycd
