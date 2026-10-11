import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Invisible mount.  No Designer UX change — this only starts Sentry
 * (errors + tracing + replay + browser logs).
 */
export function SentryInit() {
  const router = useRouter();

  useEffect(() => {
    void import("./sentry")
      .then((mod) => {
        try {
          mod.initSentry(router);
        } catch (err) {
          console.error("Sentry init failed:", err);
        }
      })
      .catch((err) => {
        console.error("Sentry load failed:", err);
      });
  }, [router]);

  return null;
}
