# Jay Wedgeworth — Personal Site

Canonical repository for **[jays.services](https://jays.services)** and **[jaywedgeworth.com](https://jaywedgeworth.com)**.

The portfolio shows 11 app families across coding, financial research, and everyday utilities.  Usage Monitor has distinct Client and Local editions, each linked to its own Simple With Us page.  The portfolio links to public product pages, websites, and source where available; Simple With Us maintains platform release details.  The site deploys from GitHub `main` → `site/`, behind Cloudflare.

## Layout

| Path | What |
|------|------|
| `site/` | Full React / TanStack Start source (personal Vercel Hobby project) |
| `static/` | Public assets snapshot (`app-icons`, `social-icons`) |
| `.github/workflows/` | Fleet CI, effort-issue sync, live-site mirror |
| `scripts/` | Fleet Slack / effort helpers |

## Live deploy

The production site is the Vercel project **personal-site** on team **Jay's Services** (`jayw`), linked to this GitHub repo, root directory `site/`.  Domains `jays.services` / `jaywedgeworth.com` stay on Cloudflare in front.  Do not publish production from the xAI Grok builder.

## Observability

**Datadog only.**  There is no Sentry project for `jays.services`.  Do not
create one, including a tiny unhandled-window-error project.  Agents must
stop assuming Sentry covers this site.

Datadog logs, APM, and RUM use the **existing** Datadog account.  Attach the
already-created env vars on the Vercel `personal-site` project (`DD_API_KEY`,
`DD_SITE`, `DD_APPLICATION_ID`, `DD_CLIENT_TOKEN`).  Production fails closed
if those are missing.  Do not commit secret values.  PagerDuty is unused here.
Datadog Session Replay stays off so it cannot collide with Sentry Replay
(which this site also does not run).

## Local

```sh
cd site
npm install
npm run dev
```

## License

Apache License 2.0.
