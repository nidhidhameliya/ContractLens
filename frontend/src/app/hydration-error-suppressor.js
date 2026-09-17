'use client';

/**
 * Custom React root error handler.
 * Next.js 16 passes recoverable errors (like hydration mismatches) through
 * React's onRecoverableError hook. By overriding console.error BEFORE
 * React initialises, we prevent the dev overlay from showing for errors
 * that are purely caused by browser extensions injecting HTML attributes.
 *
 * This file is loaded automatically by Next.js as a client component entry point.
 */
if (typeof window !== 'undefined') {
  const _orig = console.error.bind(console);
  const SUPPRESSED = [
    'bis_skin_checked',
    'A tree hydrated but some attributes',
    'Hydration failed',
    'did not match',
    'Warning: Expected server HTML',
    'Text content does not match',
  ];

  console.error = function (...args) {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (SUPPRESSED.some((p) => msg.includes(p))) return;
    _orig(...args);
  };
}
