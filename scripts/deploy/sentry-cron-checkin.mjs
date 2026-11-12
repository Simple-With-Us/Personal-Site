/**
 * Sentry Crons check-in for the two Vercel production catch-up workflows.
 *
 * The shared fleet reporter upserts whatever crontab the caller declares, with
 * a 15-minute check-in margin this caller cannot override. GitHub delivers
 * `41 * * * *` about four times a day (measured 2026-10-28 through 2026-11-11:
 * gaps 3.35h–10.62h, median about 6.4h, zero failed runs). A hourly monitor
 * with a 15-minute margin records a miss for every hour that never starts.
 *
 * Each workflow therefore checks in under one slug, `ci-personal-site-` plus
 * the slug of its own `name:`, which is the slug the existing monitor already
 * has. The schedule Sentry stores is an interval that covers that delivery,
 * not the hourly crontab GitHub is asked to attempt. The attempt cadence stays
 * hourly so a quiet main branch is still retried whenever Actions actually
 * starts the run. Open and close derive the same check-in id from the run, so
 * the in_progress check-in is closed by the real job result.
 *
 * A missing or rejected DSN never fails the catch-up. The deploy gate is
 * unchanged: a skipped deploy is a successful no-op.
 */

import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const APP = 'personal-site';

/** Hours between check-ins Sentry should require. Covers the measured max gap. */
export const MONITOR_INTERVAL_HOURS = 12;

/** Extra minutes after the interval before a check-in counts as missed. */
export const CHECKIN_MARGIN_MINUTES = 120;

/** Minutes an in_progress check-in may stay open before Sentry calls it timed out. */
export const MAX_RUNTIME_MINUTES = 60;

export const MONITORS = {
  'Vercel production catch-up': 'ci-personal-site-vercel-production-catch-up',
  'Vercel production catch-up (start)': 'ci-personal-site-vercel-production-catch-up-start',
};

const NAMESPACE_URL = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');

export function slugify(name) {
  const dashed = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return dashed.replace(/-+/g, '-');
}

export function expectedSlug(workflowName) {
  return `ci-${APP}-${slugify(workflowName)}`;
}

export function monitorSlug(workflowName) {
  const slug = MONITORS[workflowName];
  if (!slug || slug !== expectedSlug(workflowName)) return null;
  return slug;
}

export function missAfterMinutes() {
  return MONITOR_INTERVAL_HOURS * 60 + CHECKIN_MARGIN_MINUTES;
}

export function monitorConfig() {
  return {
    schedule: { type: 'interval', value: MONITOR_INTERVAL_HOURS, unit: 'hour' },
    checkin_margin: CHECKIN_MARGIN_MINUTES,
    max_runtime: MAX_RUNTIME_MINUTES,
    timezone: 'UTC',
  };
}

export function checkInId(slug, runId, attempt) {
  const hash = createHash('sha1');
  hash.update(NAMESPACE_URL);
  hash.update(`${APP}/${slug}/${runId}/attempt/${attempt || '1'}`);
  const bytes = hash.digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes.subarray(0, 16).toString('hex');
}

/**
 * Map the two job results to the cron status.
 * `skipped` deploy is the clean no-op (catch-up disabled, or the gate said
 * not to publish). `failure` is the only result that reports error.
 * `cancelled` matches the shared reporter, which does not page a cancel.
 */
export function terminalStatus(testResult, deployResult) {
  if (testResult === 'failure' || deployResult === 'failure') return 'error';
  const quiet = new Set(['success', 'skipped', 'cancelled']);
  if (quiet.has(testResult) && quiet.has(deployResult)) return 'ok';
  return 'error';
}

export function parseDsn(dsn) {
  const match = /^https:\/\/([^@]+)@([^/]+)\/(.+)$/.exec(String(dsn || '').trim());
  if (!match) return null;
  return { publicKey: match[1], host: match[2], projectId: match[3] };
}

function timestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function runUrl(env) {
  const repo = env.GITHUB_REPOSITORY || '';
  const id = env.GITHUB_RUN_ID || '';
  if (!repo || !id) return '';
  const server = env.GITHUB_SERVER_URL || 'https://github.com';
  return `${server}/${repo}/actions/runs/${id}`;
}

function failureEvent(env, workflowName) {
  const branch = env.GITHUB_REF_NAME || '';
  const runId = env.GITHUB_RUN_ID || '';
  return {
    type: 'event',
    payload: {
      event_id: randomUUID().replaceAll('-', ''),
      timestamp: timestamp(),
      platform: 'other',
      level: 'error',
      environment: 'fleet-ci',
      message: `CI workflow failure: ${workflowName} [${APP}]`,
      tags: {
        app: APP,
        workflow: workflowName,
        branch,
        actor: env.GITHUB_ACTOR || '',
      },
      extra: { run_url: runUrl(env), run_id: runId, branch },
      fingerprint: ['ci-failure', APP, workflowName],
    },
  };
}

export function buildPlan(env) {
  const warnings = [];
  const logs = [];
  const items = [];
  const workflowName = env.GITHUB_WORKFLOW || '';
  const phase = env.CRON_CHECKIN_PHASE || '';
  const eventName = env.GITHUB_EVENT_NAME || '';
  const slug = monitorSlug(workflowName);

  if (!slug) {
    warnings.push(`::warning::no Sentry cron monitor for workflow '${workflowName}'; check-in skipped`);
    return { warnings, logs, items };
  }
  if (phase !== 'open' && phase !== 'close') {
    warnings.push(`::warning::CRON_CHECKIN_PHASE must be open or close; check-in skipped`);
    return { warnings, logs, items };
  }
  if (eventName === 'pull_request') {
    logs.push(`Workflow '${workflowName}' is a pull request; no cron check-in sent.`);
    return { warnings, logs, items };
  }

  const runId = env.GITHUB_RUN_ID || '';
  const attempt = env.GITHUB_RUN_ATTEMPT || '1';
  const config = monitorConfig();

  if (phase === 'open') {
    if (eventName !== 'schedule') {
      logs.push(`Workflow '${workflowName}' was requested by '${eventName}' (not schedule); no in_progress check-in sent.`);
      return { warnings, logs, items };
    }
    if (!runId) {
      warnings.push(`::warning::in_progress check-in skipped for '${workflowName}': GITHUB_RUN_ID is empty, so close could not finish the same check-in`);
      return { warnings, logs, items };
    }
    const checkIn = checkInId(slug, runId, attempt);
    items.push({
      type: 'check_in',
      payload: {
        check_in_id: checkIn,
        monitor_slug: slug,
        status: 'in_progress',
        monitor_config: config,
      },
    });
    return { warnings, logs, items };
  }

  const testResult = env.TEST_RESULT || '';
  const deployResult = env.DEPLOY_RESULT || '';
  const status = terminalStatus(testResult, deployResult);

  if (status === 'error') items.push(failureEvent(env, workflowName));

  if (eventName === 'schedule') {
    const checkIn = runId ? checkInId(slug, runId, attempt) : randomUUID().replaceAll('-', '');
    items.push({
      type: 'check_in',
      detail: `test=${testResult || 'missing'} deploy=${deployResult || 'missing'}`,
      payload: {
        check_in_id: checkIn,
        monitor_slug: slug,
        status,
        monitor_config: config,
      },
    });
  } else if (status !== 'error') {
    logs.push(`Workflow '${workflowName}' was triggered by '${eventName}' (not schedule); no cron check-in sent.`);
  }

  return { warnings, logs, items };
}

export function envelopeBody(item) {
  const itemBody = JSON.stringify(item.payload);
  const header = JSON.stringify({ sent_at: timestamp() });
  const itemHeader = JSON.stringify({ type: item.type, length: Buffer.byteLength(itemBody) });
  return `${header}\n${itemHeader}\n${itemBody}\n`;
}

export async function postEnvelope(target, item) {
  const response = await fetch(target.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': target.auth,
    },
    body: envelopeBody(item),
    signal: AbortSignal.timeout(15_000),
  });
  console.log(`Sentry envelope POST (${item.type}) -> HTTP ${response.status}`);
  if (!response.ok) {
    console.warn(`::warning::Sentry envelope POST (${item.type}) failed: HTTP ${response.status}`);
  }
}

export async function main(env = process.env, post = postEnvelope) {
  const dsn = String(env.SENTRY_FLEET_DSN || '').trim();
  const plan = buildPlan(env);
  for (const line of plan.logs) console.log(line);
  for (const warning of plan.warnings) console.warn(warning);
  if (!plan.items.length) return 0;
  if (!dsn) {
    console.warn('::warning::SENTRY_FLEET_DSN secret is not set; skipping Sentry report for this run.');
    return 0;
  }
  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.error('::error::SENTRY_FLEET_DSN is not in the expected https://<key>@<host>/<project> shape');
    return 0;
  }
  const target = {
    url: `https://${parsed.host}/api/${parsed.projectId}/envelope/`,
    auth: `Sentry sentry_version=7, sentry_client=sentry-cron-checkin/1.0, sentry_key=${parsed.publicKey}`,
  };
  for (const item of plan.items) {
    try {
      await post(target, item);
    } catch (err) {
      const name = err && err.name ? err.name : 'Error';
      console.warn(`::warning::Sentry envelope POST (${item.type}) failed: ${name}`);
      continue;
    }
    if (item.type === 'check_in') {
      const detail = item.detail ? `, ${item.detail}` : '';
      console.log(`Sent Sentry Crons check-in '${item.payload.status}' for monitor '${item.payload.monitor_slug}' (check_in_id ${item.payload.check_in_id}${detail}).`);
    } else if (item.type === 'event') {
      console.log(`Sent Sentry failure event for workflow '${item.payload.tags.workflow}'.`);
    }
  }
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().then((code) => {
    process.exitCode = code;
  });
}
