"use client";

import { useEffect, useRef, useState } from "react";
import { IconShield, IconRotateCcw } from "@/components/ui/icons";

type Props = {
  currentUrl: string;
  htmlContent: string;
  onNavigate: (url: string, method?: "GET" | "POST", body?: string) => void;
};

export function BrowserFrame({ currentUrl, htmlContent, onNavigate }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [prevUrl, setPrevUrl] = useState(currentUrl);
  const [addressInput, setAddressInput] = useState(currentUrl);
  if (prevUrl !== currentUrl) {
    setPrevUrl(currentUrl);
    setAddressInput(currentUrl);
  }

  // Listen for navigation messages from the sandboxed iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") return;
      // Confirm the message originated strictly from our sandboxed iframe's window
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      if (event.data.type === "CYBER_NAVIGATE") {
        const url = event.data.url;
        if (typeof url !== "string") return;
        const normalized = url.trim().toLowerCase();
        // Disallow dangerous URI schemes
        if (normalized.startsWith("javascript:") || normalized.startsWith("data:") || normalized.startsWith("vbscript:")) return;
        onNavigate(url, event.data.method || "GET", event.data.body);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onNavigate]);

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addressInput.trim()) {
      onNavigate(addressInput.trim());
    }
  };

  // Inject client-side interception script into the rendered HTML
  const injectedHtml = `
    ${htmlContent}
    <script>
      (function() {
        document.addEventListener('click', function(e) {
          var a = e.target.closest('a');
          if (a && a.getAttribute('href')) {
            e.preventDefault();
            var href = a.getAttribute('href');
            window.parent.postMessage({ type: 'CYBER_NAVIGATE', url: href, method: 'GET' }, '*');
          }
        }, true);

        document.addEventListener('submit', function(e) {
          e.preventDefault();
          var form = e.target;
          var action = form.getAttribute('action') || window.location.pathname;
          var method = (form.getAttribute('method') || 'GET').toUpperCase();
          var formData = new FormData(form);
          var searchParams = new URLSearchParams();
          for (var pair of formData.entries()) {
            searchParams.append(pair[0], pair[1]);
          }
          if (method === 'GET') {
            var sep = action.indexOf('?') !== -1 ? '&' : '?';
            window.parent.postMessage({ type: 'CYBER_NAVIGATE', url: action + sep + searchParams.toString(), method: 'GET' }, '*');
          } else {
            window.parent.postMessage({ type: 'CYBER_NAVIGATE', url: action, method: 'POST', body: searchParams.toString() }, '*');
          }
        }, true);
      })();
    </script>
  `;

  return (
    <div className="rounded-sm border border-line bg-console flex flex-col h-[520px] shadow-2xl overflow-hidden">
      {/* Browser Chrome Header with persistent SIMULATED TARGET indicator */}
      <div className="bg-surface border-b border-line px-3.5 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 items-center">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
          </div>

          {/* Persistent Simulated Target Badge */}
          <div className="flex items-center gap-1.5 border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 rounded-xs font-ui text-[10px] font-bold text-amber-400 tracking-wider">
            <IconShield className="h-3 w-3" />
            <span>SIMULATED TARGET // SANDBOX</span>
          </div>
        </div>

        {/* URL Bar */}
        <form onSubmit={handleAddressSubmit} className="flex-1 max-w-lg flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate(currentUrl)}
            className="p-1.5 rounded-xs text-muted hover:text-cyan hover:bg-surface-raised border border-line/60 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            title="Reload target page"
            aria-label="Reload target page"
          >
            <IconRotateCcw className="h-3.5 w-3.5" />
          </button>

          <div className="flex-1 flex items-center rounded-xs bg-surface-subtle border border-line px-2.5 py-1 focus-within:border-cyan focus-within:ring-1 focus-within:ring-cyan">
            <span className="text-[10px] font-mono text-muted/60 mr-1.5 select-none">HTTP</span>
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              className="w-full bg-transparent font-mono text-xs text-ink outline-none"
              placeholder="http://target.internal/..."
              aria-label="Target URL"
            />
          </div>

          <button
            type="submit"
            className="px-3 py-1 font-ui text-xs font-semibold text-cyan border border-cyan/50 bg-cyan/15 rounded-xs hover:bg-cyan hover:text-void transition-colors uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            GO
          </button>
        </form>
      </div>

      {/* Sandboxed Browser Viewport */}
      <div className="flex-1 relative bg-void">
        <iframe
          ref={iframeRef}
          srcDoc={injectedHtml}
          title="Sandboxed WebApp Target"
          sandbox="allow-scripts allow-forms"
          className="w-full h-full border-0 bg-void"
        />
      </div>
    </div>
  );
}
