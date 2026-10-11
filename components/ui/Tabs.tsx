"use client";

import {
  createContext,
  useContext,
  useState,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from "react";

interface TabsContextValue {
  selectedId: string;
  selectTab: (id: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className = "",
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (val: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [internalVal, setInternalVal] = useState(defaultValue ?? "");
  const baseId = useId();

  const selectedId = value !== undefined ? value : internalVal;

  function selectTab(id: string) {
    if (value === undefined) {
      setInternalVal(id);
    }
    onValueChange?.(id);
  }

  return (
    <TabsContext.Provider value={{ selectedId, selectTab, baseId }}>
      <div className={`flex flex-col ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({
  children,
  className = "",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    );
    const index = tabs.findIndex((tab) => tab === document.activeElement);
    if (index === -1) return;

    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`flex items-center gap-1 border-b border-line ${className}`}
    >
      {children}
    </div>
  );
}

export function Tab({
  value,
  children,
  disabled = false,
  className = "",
}: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tab must be used within Tabs");

  const isSelected = ctx.selectedId === value;
  const tabId = `${ctx.baseId}-tab-${value}`;
  const panelId = `${ctx.baseId}-panel-${value}`;

  return (
    <button
      role="tab"
      id={tabId}
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={() => ctx.selectTab(value)}
      className={`px-3 py-2 font-ui text-xs tracking-wider uppercase transition-colors border-b-2 -mb-px focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${
        isSelected
          ? "border-cyan text-cyan font-semibold"
          : "border-transparent text-muted hover:text-ink hover:border-line"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${className}`}
    >
      {children}
    </button>
  );
}

export function TabPanel({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabPanel must be used within Tabs");

  const isSelected = ctx.selectedId === value;
  const tabId = `${ctx.baseId}-tab-${value}`;
  const panelId = `${ctx.baseId}-panel-${value}`;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
      className={`pt-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan ${className}`}
    >
      {children}
    </div>
  );
}
