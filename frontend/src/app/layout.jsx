
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import ThemeProvider from "@/components/ThemeProvider";
import BisAttributeCleaner from "@/components/BisAttributeCleaner";
import ExtensionErrorSuppressor from "@/components/ExtensionErrorSuppressor";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap"
});

export const metadata = {
  title: "Termora — Premium Contract Intelligence",
  description:
  "Enterprise-grade AI contract risk monitoring and automated approval system."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // ── 1. Apply theme before first paint ────────────────────────────
                try {
                  var saved = localStorage.getItem('Termora_theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}

                // ── 2. ROOT FIX for bis_skin_checked hydration mismatch ──────────
                // Bitdefender / Kaspersky inject bis_skin_checked="1" into DOM nodes
                // BEFORE React hydrates, causing a server/client mismatch that
                // triggers Next.js dev overlay. The only real fix is to physically
                // strip these attributes from the DOM before React's hydration
                // comparison runs — not patch console.error (too late for the overlay).

                function stripBis(root) {
                  try {
                    (root || document).querySelectorAll('[bis_skin_checked]').forEach(function(el) {
                      el.removeAttribute('bis_skin_checked');
                    });
                  } catch(e) {}
                }

                // Strip any already-injected attributes immediately
                stripBis(document.documentElement);

                // Watch for NEW injections in real-time (MutationObserver fires
                // synchronously inside the same microtask, before React reads the DOM)
                try {
                  var _bisObserver = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var m = mutations[i];
                      if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked') {
                        m.target.removeAttribute('bis_skin_checked');
                      }
                      if (m.type === 'childList') {
                        m.addedNodes.forEach(function(node) {
                          if (node.nodeType === 1) {
                            node.removeAttribute('bis_skin_checked');
                            node.querySelectorAll('[bis_skin_checked]').forEach(function(el) {
                              el.removeAttribute('bis_skin_checked');
                            });
                          }
                        });
                      }
                    }
                  });
                  _bisObserver.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['bis_skin_checked'],
                  });
                  // Disconnect after hydration is complete (React hydrates within ~3s)
                  setTimeout(function() { _bisObserver.disconnect(); }, 8000);
                } catch(e) {}

                // ── 3. Suppress console noise from extensions (belt-and-suspenders) ─
                var _origErr = console.error;
                console.error = function() {
                  var msg = typeof arguments[0] === 'string' ? arguments[0] : '';
                  if (
                    msg.indexOf('bis_skin_checked') !== -1 ||
                    msg.indexOf('A tree hydrated but some attributes') !== -1 ||
                    msg.indexOf('chrome-extension') !== -1 ||
                    msg.indexOf('moz-extension') !== -1
                  ) return;
                  _origErr.apply(console, arguments);
                };
              })();
            `
          }}
        />

        
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        
        <ExtensionErrorSuppressor />
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
        <BisAttributeCleaner />
      </body>
    </html>);

}