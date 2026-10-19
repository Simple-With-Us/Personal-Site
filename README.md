# Jay Wedgeworth — Personal Site

Canonical repository for **[jays.services](https://jays.services)** and **[jaywedgeworth.com](https://jaywedgeworth.com)**.

The portfolio shows 11 app families across coding, financial research, and everyday utilities.  Usage Monitor has distinct Client and Local editions, each linked to its own Simple With Us page.  The portfolio links to public product pages, websites, and source where available; Simple With Us maintains platform release details.  The site deploys from GitHub `main` → `site/`, behind Cloudflare.

## Layout

| Path | What |
|------|------|
| `site/` | Full React / TanStack Start source (personal Vercel Hobby project) |
| `static/` | Public assets snapshot (`app-icons`, `social-icons`) |
| `.github/workflows/` | Fleet CI, effort-issue sync, live-site mirror |
| `scripts/` | Effort-issue sync, Infisical fetch, Sentry CI report, deploy helper |

## Live deploy

The production site is the Vercel project **personal-site** on team **Jay's Services** (`jayw`), linked to this GitHub repo, root directory `site/`.  Domains `jays.services` / `jaywedgeworth.com` stay on Cloudflare in front.  Do not publish production from the xAI Grok builder.

## Observability

Browser errors, tracing, Session Replay, and logs go to the existing
Sentry project **`personal-site`**.  Attach `SENTRY_DSN` (and
`SENTRY_AUTH_TOKEN` for source-map upload) on the Vercel `personal-site`
project.  Release is `VERCEL_GIT_COMMIT_SHA`.  Do not commit secret values.

Server logs and APM stay on the existing Datadog account (`DD_API_KEY`,
`DD_SITE`).  Do not run Datadog RUM next to Sentry Replay.  PagerDuty is
unused here.

## Local

```sh
cd site
npm install
npm run dev
```

## License

Apache License 2.0.
