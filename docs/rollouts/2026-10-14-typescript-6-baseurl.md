# 2026-10-14 — TypeScript 6 without baseUrl

## Summary

Renovate PR #179 bumps `typescript` from `^5.7.0` to `^6.0.0` (locked at 6.0.3).  Site CI `npm run typecheck` failed with TS5101: `baseUrl` is deprecated and errors in TypeScript 6.

`site/tsconfig.json` used `"baseUrl": "."` only so `paths` could resolve.  TypeScript 6 resolves `paths` relative to the config file, and the existing mapping is already `"./src/*"`.  `baseUrl` is removed.  The `@/*` alias is unchanged for `tsc` and for Vite `resolve.tsconfigPaths`.

`ignoreDeprecations: "6.0"` is not used.  That flag only hides the error until TypeScript 7 removes `baseUrl`.

Branch `renovate/typescript-6.x`.

## Files

- `site/tsconfig.json` — drop `baseUrl`
- `STATUS.md`

## Verification

```bash
cd site && npm ci --no-audit --no-fund
npm run typecheck
npm run lint
npm run test:unit
```
