"use client";

import { useEffect, useRef, useState } from "react";

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
    <div className="border border-line bg-console flex flex-col h-[520px]">
      {/* Browser Chrome Header */}
      <div className="bg-void/80 border-b border-line px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1.5 items-center mr-2">
          <span className="h-2.5 w-2.5 rounded-full bg-pink/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-cyan/80" />
        </div>

        <button
          type="button"
          onClick={() => onNavigate(currentUrl)}
          className="px-2 py-0.5 text-xs font-mono text-muted hover:text-cyan border border-line/60 bg-console transition-colors"
          title="Reload target page"
        >
          ⟳
        </button>

        <form onSubmit={handleAddressSubmit} className="flex-1 flex gap-1 items-center">
          <div className="flex-1 flex items-center bg-console border border-line px-2 py-0.5">
            <span className="text-[10px] font-mono text-muted mr-1.5 select-none">🔒 HTTP</span>
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              className="w-full bg-transparent font-mono text-xs text-ink outline-none"
              placeholder="http://target.internal/..."
            />
          </div>
          <button
            type="submit"
            className="px-2.5 py-0.5 font-mono text-xs text-cyan border border-cyan/40 bg-cyan/10 hover:bg-cyan/20 transition-colors uppercase tracking-wider"
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
