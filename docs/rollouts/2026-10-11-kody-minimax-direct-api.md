# 2026-10-11 — Route Kody Autofix Through MiniMax Direct API

## Summary

The Kody autofix caller uses the direct MiniMax API with model `MiniMax-M3`, endpoint `https://api.minimax.io/v1`, and `MINIMAX_API_KEY` forwarded as the reusable workflow's generic `MODEL_API_KEY`.  The final reusable workflow pin is J, `fea7cd120407b157c3d1f5edc5b08ff15d3f0e73`, which pins I, `b1503884`, with MiniMax reasoning disabled to avoid upstream answer truncation.

The caller keeps its display name, trigger and sender gates, permissions, concurrency, `web` profile, `site/src/` source scope, and five-attempt daily budget.  The synthetic provider compatibility canary passed without a paid API call.

Branch: `codex/cts-330-direct-minimax`.  Pull request [#182](https://github.com/Simple-With-Us/Personal-Site/pull/182) is open and awaits current-head review.

## Verification

`actionlint .github/workflows/kody-fleet-autofix.yml` passes.  GitHub CI and the required review are pending on the pull request.

## Update 2026-10-21

PR [#225](https://github.com/Simple-With-Us/Personal-Site/pull/225) changed the billed model id to `MiniMax-M3.1-Flash` and renamed the caller to `Kody MiniMax M3.1 Flash Fix Proposals`, so the model id and display name stated above are superseded.  The reusable workflow pin stated above is superseded as well: `.github/workflows/kody-fleet-autofix.yml` now pins `31659885f58f08e129b6dc092f3493d7cdb74a11`, whose trusted-helper checkout is `d06ac2d47bc3b9182ea43deee9f0a91ffdf33ab0`, not J/`fea7cd12...` and I/`b1503884`.  That helper disables MiniMax reasoning only for the exact `MiniMax-M3` id; the `MiniMax-M3.1-Flash` id instead sends `reasoning_split`.  That re-enables reasoning on the paid lane and re-opens the upstream answer-truncation risk the summary above records as the reason for disabling it, because `LIMITS.outputTokens` is still 16,384 and `LIMITS.modelMs` is still 240,000 ms; the risk is tracked as an open fleet item in `docs/rollouts/2026-10-21-minimax-m31-flash-pin.md`.
