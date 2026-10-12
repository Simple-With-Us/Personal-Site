# 2026-10-11 — Route Kody Autofix Through MiniMax Direct API

## Summary

The Kody autofix caller uses the direct MiniMax API with model `MiniMax-M3`, endpoint `https://api.minimax.io/v1`, and `MINIMAX_API_KEY` forwarded as the reusable workflow's generic `MODEL_API_KEY`.  The reusable workflow pin is `614ec3938cd7a86bc30a5a5b2367b29fabf40005`.

The caller keeps its display name, trigger and sender gates, permissions, concurrency, `web` profile, `site/src/` source scope, and five-attempt daily budget.  The synthetic provider compatibility canary passed without a paid API call.

Branch: `codex/cts-330-direct-minimax`.  Pull request: pending.

## Verification

`actionlint .github/workflows/kody-fleet-autofix.yml` passes.  GitHub CI and the required review are pending on the pull request.
