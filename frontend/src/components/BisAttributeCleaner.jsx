"use client";

import { useEffect } from "react";

/**
 * Removes `bis_skin_checked` attributes injected by browser extensions (e.g. Kaspersky).
 * These cause React hydration mismatch warnings. This component runs client-side only.
 */
export default function BisAttributeCleaner() {
  useEffect(() => {
    // Strip any already-injected attributes
    document.querySelectorAll("[bis_skin_checked]").forEach((el) => {
      el.removeAttribute("bis_skin_checked");
    });

    // Observe future injections and remove them immediately
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
        mutation.type === "attributes" &&
        mutation.attributeName === "bis_skin_checked")
        {
          mutation.target.removeAttribute("bis_skin_checked");
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ["bis_skin_checked"]
    });

    return () => observer.disconnect();
  }, []);

  return null;
}