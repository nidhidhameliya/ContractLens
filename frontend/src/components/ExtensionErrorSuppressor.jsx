"use client";

import { useEffect } from "react";

/**
 * Intercepts and suppresses runtime errors caused by browser extensions
 * (e.g., ad blockers, antivirus extensions like Kaspersky) so they don't
 * trigger the Next.js error overlay or crash the application.
 */
export default function ExtensionErrorSuppressor() {
  useEffect(() => {
    const handleError = (e) => {
      // Check if error originates from a chrome extension or contains the specific M_ID error
      if (
      e.filename?.includes("chrome-extension://") ||
      e.error?.stack?.includes("chrome-extension://") ||
      e.message?.includes("M_ID"))
      {
        e.stopImmediatePropagation();
        e.preventDefault();
        console.warn("Suppressed browser extension error:", e.message);
        return true;
      }
    };

    const handleRejection = (e) => {
      if (e.reason?.stack?.includes("chrome-extension://")) {
        e.stopImmediatePropagation();
        e.preventDefault();
        console.warn("Suppressed browser extension promise rejection:", e.reason?.message);
      }
    };

    // Use capture phase (true) to intercept the error before Next.js does
    window.addEventListener("error", handleError, true);
    window.addEventListener("unhandledrejection", handleRejection, true);

    // Also suppress React's/Next.js console.error for these specific extension errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const msg = typeof args[0] === "string" ? args[0] : "";
      const err = args[0] instanceof Error ? args[0] : null;

      if (
      msg.includes("chrome-extension://") ||
      msg.includes("M_ID") ||
      msg.includes("bis_skin_checked") ||
      msg.includes("A tree hydrated but some attributes") ||
      msg.includes("Hydration failed because") ||
      msg.includes("Text content did not match. Server:") ||
      err?.stack?.includes("chrome-extension://"))
      {
        return; // Silently drop it
      }
      originalConsoleError.apply(console, args);
    };

    return () => {
      window.removeEventListener("error", handleError, true);
      window.removeEventListener("unhandledrejection", handleRejection, true);
      console.error = originalConsoleError;
    };
  }, []);

  return null;
}