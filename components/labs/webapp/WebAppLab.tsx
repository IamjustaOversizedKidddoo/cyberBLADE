"use client";

import { useCallback, useMemo, useState } from "react";
import type { DispatchResult, HttpExchange, WebAppEnv } from "@/lib/lab-engine/webapp/types";
import { dispatchHttpRequest } from "@/lib/lab-engine/webapp/simulator";
import { dispatchWebAppRequestAction } from "@/app/(app)/labs/actions";
import { BrowserFrame } from "./BrowserFrame";
import { HttpInspector } from "./HttpInspector";

type Props = {
  env: WebAppEnv;
  attemptId?: string;
};

function executeRequestLoopSync(
  env: WebAppEnv,
  initialTarget: string,
  initialMethod: "GET" | "POST",
  initialBody: string | undefined,
  startCookies: Record<string, string>,
  startStorage: Record<string, string>,
  startDatabase: Record<string, Array<Record<string, unknown>>>,
) {
  let currentTarget = initialTarget;
  let method = initialMethod;
  let body = initialBody;
  let curCookies = startCookies;
  let curStorage = startStorage;
  let curDatabase = startDatabase;
  let hops = 0;
  const newExchanges: HttpExchange[] = [];
  let finalUrl = initialTarget;
  let finalHtml = "<p>Connecting to target application...</p>";

  while (hops < 5) {
    hops++;
    const fullUrl = currentTarget.startsWith("http")
      ? currentTarget
      : `${env.baseUrl}${currentTarget.startsWith("/") ? "" : "/"}${currentTarget}`;

    const res = dispatchHttpRequest({
      env,
      request: {
        method,
        url: fullUrl,
        headers: {
          "User-Agent": "CyberBLADE-Browser/2.0 (Security Sandbox)",
          Accept: "text/html,application/xhtml+xml,application/json,*/*",
          ...(curCookies && Object.keys(curCookies).length > 0
            ? { Cookie: Object.entries(curCookies).map(([k, v]) => `${k}=${v}`).join("; ") }
            : {}),
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body,
      },
      currentCookies: curCookies,
      currentStorage: curStorage,
      currentDatabase: curDatabase,
    });

    curCookies = res.updatedCookies;
    curStorage = res.updatedStorage;
    curDatabase = res.updatedDatabase;
    newExchanges.push(res.exchange);

    if (
      (res.exchange.response.status === 301 ||
        res.exchange.response.status === 302 ||
        res.exchange.response.status === 303 ||
        res.exchange.response.status === 307) &&
      res.exchange.response.headers.Location
    ) {
      currentTarget = res.exchange.response.headers.Location;
      method = "GET";
      body = undefined;
      continue;
    }

    finalUrl = fullUrl;
    finalHtml = res.exchange.response.body;
    break;
  }

  return {
    finalUrl,
    finalHtml,
    updatedCookies: curCookies,
    updatedStorage: curStorage,
    updatedDatabase: curDatabase,
    exchanges: newExchanges,
  };
}

async function executeRequestLoop(
  env: WebAppEnv,
  initialTarget: string,
  initialMethod: "GET" | "POST",
  initialBody: string | undefined,
  startCookies: Record<string, string>,
  startStorage: Record<string, string>,
  startDatabase: Record<string, Array<Record<string, unknown>>>,
  attemptId?: string,
) {
  let currentTarget = initialTarget;
  let method = initialMethod;
  let body = initialBody;
  let curCookies = startCookies;
  let curStorage = startStorage;
  let curDatabase = startDatabase;
  let hops = 0;
  const newExchanges: HttpExchange[] = [];
  let finalUrl = initialTarget;
  let finalHtml = "<p>Connecting to target application...</p>";

  while (hops < 5) {
    hops++;
    const fullUrl = currentTarget.startsWith("http")
      ? currentTarget
      : `${env.baseUrl}${currentTarget.startsWith("/") ? "" : "/"}${currentTarget}`;

    const req = {
      method,
      url: fullUrl,
      headers: {
        "User-Agent": "CyberBLADE-Browser/2.0 (Security Sandbox)",
        Accept: "text/html,application/xhtml+xml,application/json,*/*",
        ...(curCookies && Object.keys(curCookies).length > 0
          ? { Cookie: Object.entries(curCookies).map(([k, v]) => `${k}=${v}`).join("; ") }
          : {}),
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body,
    };

    let res: DispatchResult;
    if (attemptId) {
      try {
        res = await dispatchWebAppRequestAction(attemptId, req, curCookies, curStorage, curDatabase);
      } catch {
        res = dispatchHttpRequest({
          env,
          request: req,
          currentCookies: curCookies,
          currentStorage: curStorage,
          currentDatabase: curDatabase,
        });
      }
    } else {
      res = dispatchHttpRequest({
        env,
        request: req,
        currentCookies: curCookies,
        currentStorage: curStorage,
        currentDatabase: curDatabase,
      });
    }

    curCookies = res.updatedCookies;
    curStorage = res.updatedStorage;
    curDatabase = res.updatedDatabase;
    newExchanges.push(res.exchange);

    if (
      (res.exchange.response.status === 301 ||
        res.exchange.response.status === 302 ||
        res.exchange.response.status === 303 ||
        res.exchange.response.status === 307) &&
      res.exchange.response.headers.Location
    ) {
      currentTarget = res.exchange.response.headers.Location;
      method = "GET";
      body = undefined;
      continue;
    }

    finalUrl = fullUrl;
    finalHtml = res.exchange.response.body;
    break;
  }

  return {
    finalUrl,
    finalHtml,
    updatedCookies: curCookies,
    updatedStorage: curStorage,
    updatedDatabase: curDatabase,
    exchanges: newExchanges,
  };
}

export function WebAppLab({ env, attemptId }: Props) {
  const initial = useMemo(
    () =>
      executeRequestLoopSync(
        env,
        env.initialUrl,
        "GET",
        undefined,
        env.initialCookies ?? {},
        env.initialStorage ?? {},
        env.database,
      ),
    [env],
  );

  const [currentUrl, setCurrentUrl] = useState(initial.finalUrl);
  const [htmlContent, setHtmlContent] = useState(initial.finalHtml);
  const [cookies, setCookies] = useState<Record<string, string>>(initial.updatedCookies);
  const [storage, setStorage] = useState<Record<string, string>>(initial.updatedStorage);
  const [database, setDatabase] = useState<Record<string, Array<Record<string, unknown>>>>(initial.updatedDatabase);
  const [exchanges, setExchanges] = useState<HttpExchange[]>(initial.exchanges);

  const handleNavigate = useCallback(
    async (target: string, method: "GET" | "POST" = "GET", body?: string) => {
      const outcome = await executeRequestLoop(
        env,
        target,
        method,
        body,
        cookies,
        storage,
        database,
        attemptId,
      );

      setCurrentUrl(outcome.finalUrl);
      setHtmlContent(outcome.finalHtml);
      setCookies(outcome.updatedCookies);
      setStorage(outcome.updatedStorage);
      setDatabase(outcome.updatedDatabase);
      setExchanges((prev) => [...prev, ...outcome.exchanges]);
    },
    [env, cookies, storage, database, attemptId],
  );

  const handleUpdateCookie = (name: string, value: string) => {
    setCookies((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearHistory = () => {
    setExchanges([]);
  };

  const [mobilePane, setMobilePane] = useState<"browser" | "inspector">("browser");

  return (
    <div className="space-y-4">
      {/* Target Status Bar */}
      <div className="border border-line bg-console px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
          <span className="text-muted uppercase">TARGET WEB APPLICATION:</span>
          <span className="font-bold text-ink">{env.name}</span>
          <span className="text-muted/60">({env.baseUrl})</span>
        </div>
        <div className="text-[11px] text-muted">
          STATUS: <span className="text-cyan font-semibold">200 LIVE / SANDBOXED</span>
        </div>
      </div>

      {/* Mobile Sub-Pane Selector */}
      <div className="lg:hidden grid grid-cols-2 rounded-xs border border-line bg-surface p-1 text-xs font-ui">
        <button
          type="button"
          onClick={() => setMobilePane("browser")}
          className={`min-h-[44px] rounded-xs font-bold tracking-wider transition-colors ${
            mobilePane === "browser"
              ? "bg-cyan/20 text-cyan border border-cyan/40"
              : "text-muted hover:text-ink"
          }`}
        >
          [1] BROWSER VIEW
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("inspector")}
          className={`min-h-[44px] rounded-xs font-bold tracking-wider transition-colors ${
            mobilePane === "inspector"
              ? "bg-cyan/20 text-cyan border border-cyan/40"
              : "text-muted hover:text-ink"
          }`}
        >
          [2] HTTP INSPECTOR ({exchanges.length})
        </button>
      </div>

      {/* Side-by-side on desktop or segmented on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Sandboxed Browser Chrome */}
        <div className={mobilePane === "browser" ? "block" : "hidden lg:block"}>
          <div className="font-mono text-[11px] text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>[1] IN-BROWSER SIMULATION</span>
            <span className="text-muted/60">SANDBOX_ACTIVE</span>
          </div>
          <BrowserFrame
            currentUrl={currentUrl}
            htmlContent={htmlContent}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Right: HTTP Inspector & Cookie Jar */}
        <div className={mobilePane === "inspector" ? "block" : "hidden lg:block"}>
          <div className="font-mono text-[11px] text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>[2] NETWORK TELEMETRY &amp; PROXY</span>
            <span className="text-muted/60">BURP_INSPECTOR</span>
          </div>
          <HttpInspector
            exchanges={exchanges}
            cookies={cookies}
            onUpdateCookie={handleUpdateCookie}
            onClearHistory={handleClearHistory}
          />
        </div>
      </div>
    </div>
  );
}
