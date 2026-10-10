"use client";

import { useState } from "react";
import type { HttpExchange } from "@/lib/lab-engine/webapp/types";

type Props = {
  exchanges: HttpExchange[];
  cookies: Record<string, string>;
  onUpdateCookie: (name: string, value: string) => void;
  onClearHistory: () => void;
};

export function HttpInspector({ exchanges, cookies, onUpdateCookie, onClearHistory }: Props) {
  const [activeTab, setActiveTab] = useState<"traffic" | "cookies">("traffic");
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [newCookieName, setNewCookieName] = useState("");
  const [newCookieVal, setNewCookieVal] = useState("");

  const activeExchange = exchanges[selectedIdx] ?? exchanges[exchanges.length - 1];

  const handleAddCookie = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCookieName.trim()) {
      onUpdateCookie(newCookieName.trim(), newCookieVal.trim());
      setNewCookieName("");
      setNewCookieVal("");
    }
  };

  return (
    <div className="border border-line bg-console flex flex-col h-[520px]">
      {/* Tab Switcher */}
      <div className="bg-void/80 border-b border-line px-3 py-2 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("traffic")}
            className={`font-mono text-xs px-2.5 py-0.5 uppercase tracking-wider transition-colors ${
              activeTab === "traffic"
                ? "border-b-2 border-cyan text-cyan font-semibold"
                : "text-muted hover:text-ink"
            }`}
          >
            HTTP INSPECTOR ({exchanges.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cookies")}
            className={`font-mono text-xs px-2.5 py-0.5 uppercase tracking-wider transition-colors ${
              activeTab === "cookies"
                ? "border-b-2 border-cyan text-cyan font-semibold"
                : "text-muted hover:text-ink"
            }`}
          >
            COOKIE JAR ({Object.keys(cookies).length})
          </button>
        </div>

        {activeTab === "traffic" && (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-[10px] font-mono text-muted/70 hover:text-pink transition-colors"
          >
            CLEAR LOGS
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === "traffic" ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line overflow-hidden">
          {/* Exchanges List */}
          <div className="overflow-y-auto max-h-[240px] md:max-h-none divide-y divide-line/40">
            {exchanges.length === 0 ? (
              <div className="p-4 font-mono text-xs text-muted">No HTTP exchanges captured yet.</div>
            ) : (
              exchanges.map((ex, idx) => {
                const isSelected = idx === selectedIdx;
                const statusColor =
                  ex.response.status >= 400
                    ? "text-pink"
                    : ex.response.status >= 300
                      ? "text-amber-400"
                      : "text-cyan";

                return (
                  <button
                    key={ex.request.id}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs font-mono transition-colors ${
                      isSelected ? "bg-cyan/10 border-l-2 border-cyan" : "hover:bg-void/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate mr-2">
                      <span className="font-semibold text-muted">{ex.request.method}</span>
                      <span className="truncate text-ink">{ex.request.path}</span>
                    </div>
                    <span className={`font-semibold shrink-0 ${statusColor}`}>
                      {ex.response.status}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Exchange Details Inspector */}
          <div className="overflow-y-auto p-3 text-xs font-mono flex flex-col gap-3">
            {activeExchange ? (
              <>
                <div>
                  <div className="text-[10px] text-cyan font-semibold uppercase tracking-wider mb-1">
                    REQUEST: {activeExchange.request.method} {activeExchange.request.url}
                  </div>
                  {activeExchange.request.headers && Object.keys(activeExchange.request.headers).length > 0 && (
                    <div className="bg-void p-2 border border-line/60 mb-2 space-y-0.5 text-[11px] text-muted">
                      {Object.entries(activeExchange.request.headers).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-ink">{k}:</span> {v}
                        </div>
                      ))}
                    </div>
                  )}
                  {activeExchange.request.body && (
                    <div className="bg-void p-2 border border-line/60 text-[11px] text-ink break-all">
                      <div className="text-[10px] text-muted uppercase mb-1">Payload:</div>
                      {activeExchange.request.body}
                    </div>
                  )}
                </div>

                <div className="border-t border-line/60 pt-2">
                  <div className="text-[10px] text-cyan font-semibold uppercase tracking-wider mb-1">
                    RESPONSE: {activeExchange.response.status} {activeExchange.response.statusText}
                  </div>
                  {activeExchange.response.headers && Object.keys(activeExchange.response.headers).length > 0 && (
                    <div className="bg-void p-2 border border-line/60 mb-2 space-y-0.5 text-[11px] text-muted">
                      {Object.entries(activeExchange.response.headers).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-ink">{k}:</span> {v}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bg-void p-2 border border-line/60 text-[11px] text-ink max-h-[160px] overflow-y-auto whitespace-pre-wrap break-all">
                    <div className="text-[10px] text-muted uppercase mb-1">Body Preview:</div>
                    {activeExchange.response.body}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted">Select an HTTP exchange to inspect headers and payloads.</div>
            )}
          </div>
        </div>
      ) : (
        /* Cookie Jar Tab */
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4 font-mono text-xs">
          <div>
            <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
              ACTIVE SESSION COOKIES
            </h4>
            {Object.keys(cookies).length === 0 ? (
              <div className="text-muted">No active cookies stored.</div>
            ) : (
              <div className="border border-line divide-y divide-line/60 bg-void">
                {Object.entries(cookies).map(([name, val]) => (
                  <div key={name} className="px-3 py-2 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-cyan">{name}</span> ={" "}
                      <span className="text-ink break-all">{val}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cookie Tampering / Setting Form */}
          <div className="border-t border-line/60 pt-3">
            <h4 className="text-[11px] font-semibold text-cyan uppercase tracking-wider mb-2">
              MANUALLY SET / TAMPER COOKIE
            </h4>
            <form onSubmit={handleAddCookie} className="flex flex-col md:flex-row gap-2">
              <input
                type="text"
                placeholder="Cookie Name (e.g. watchtower_role)"
                value={newCookieName}
                onChange={(e) => setNewCookieName(e.target.value)}
                className="bg-void border border-line px-2 py-1 text-ink text-xs outline-none flex-1"
                required
              />
              <input
                type="text"
                placeholder="Value (e.g. superadmin)"
                value={newCookieVal}
                onChange={(e) => setNewCookieVal(e.target.value)}
                className="bg-void border border-line px-2 py-1 text-ink text-xs outline-none flex-1"
                required
              />
              <button
                type="submit"
                className="px-3 py-1 bg-cyan/20 border border-cyan text-cyan text-xs font-semibold hover:bg-cyan/30 transition-colors uppercase tracking-wider"
              >
                UPDATE COOKIE
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
