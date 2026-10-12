# 2026-10-11 — Route Kody Autofix Through MiniMax Direct API

## Summary

The Kody autofix caller uses the direct MiniMax API with model `MiniMax-M3`, endpoint `https://api.minimax.io/v1`, and `MINIMAX_API_KEY` forwarded as the reusable workflow's generic `MODEL_API_KEY`.  The final reusable workflow pin is J, `fea7cd120407b157c3d1f5edc5b08ff15d3f0e73`, which pins I, `b1503884`, with MiniMax reasoning disabled to avoid upstream answer truncation.

The caller keeps its display name, trigger and sender gates, permissions, concurrency, `web` profile, `site/src/` source scope, and five-attempt daily budget.  The synthetic provider compatibility canary passed without a paid API call.

Branch: `codex/cts-330-direct-minimax`.  Pull request [#182](https://github.com/Simple-With-Us/Personal-Site/pull/182) is open and awaits current-head review.

## Verification

`actionlint .github/workflows/kody-fleet-autofix.yml` passes.  GitHub CI and the required review are pending on the pull request.
