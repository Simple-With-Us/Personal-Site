/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Off by default.  To enable without a code deploy, set the
 * `EMAIL_PASSWORD_ENABLED` knob to "true" in Infisical (or the admin settings
 * UI); the value below is only the default.  Then build sign-up / sign-in
 * forms with `authClient.signUp.email` / `authClient.signIn.email` from
 * `@/lib/auth/client` (see the auth skill).
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
export const EMAIL_PASSWORD_ENABLED_DEFAULT = false;
