"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { BLADEQL_SPEC } from "@/lib/lab-engine/soc/query/spec";
import { IconSearch } from "@/components/ui/icons";

export interface BladeQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  onExplain?: () => void;
  availableFields?: string[];
  isLoading?: boolean;
  error?: string | null;
  history?: string[];
}

interface AutocompleteItem {
  type: "command" | "function" | "field" | "snippet";
  label: string;
  insertText: string;
  description: string;
}

export function BladeQLEditor({
  value,
  onChange,
  onExecute,
  onExplain,
  availableFields = [],
  isLoading = false,
  error = null,
  history = [],
}: BladeQLEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteItem[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [srAnnouncement, setSrAnnouncement] = useState("");

  // Build autocomplete dictionary
  const autocompleteCatalog = useRef<AutocompleteItem[]>([]);

  useEffect(() => {
    const items: AutocompleteItem[] = [];

    // Commands
    for (const [cmd, spec] of Object.entries(BLADEQL_SPEC.commands)) {
      items.push({
        type: "command",
        label: cmd,
        insertText: `${cmd} `,
        description: spec.summary,
      });
    }

    // Functions
    for (const [fn, spec] of Object.entries(BLADEQL_SPEC.functions)) {
      items.push({
        type: "function",
        label: `${fn}()`,
        insertText: `${fn}(`,
        description: spec.summary,
      });
    }

    // Snippets
    items.push({
      type: "snippet",
      label: "stats count by user",
      insertText: "stats count by user",
      description: "Aggregate event counts by user account",
    });
    items.push({
      type: "snippet",
      label: "top 10 src_ip",
      insertText: "top 10 src_ip",
      description: "Find top 10 communicating source IP addresses",
    });
    items.push({
      type: "snippet",
      label: "where bytes_out > 10000",
      insertText: "where bytes_out > 10000",
      description: "Filter outbound network transfers exceeding 10KB",
    });

    // Available fields
    for (const field of availableFields) {
      items.push({
        type: "field",
        label: field,
        insertText: field,
        description: `Field in current log lake`,
      });
    }

    autocompleteCatalog.current = items;
  }, [availableFields]);

  // Update suggestions based on word under cursor
  const updateAutocomplete = useCallback((text: string, pos: number) => {
    const prefix = text.slice(0, pos);
    const lastWordMatch = prefix.match(/[a-zA-Z0-9_-]+$/);
    if (!lastWordMatch || lastWordMatch[0].length < 2) {
      setShowAutocomplete(false);
      return;
    }

    const query = lastWordMatch[0].toLowerCase();
    const matches = autocompleteCatalog.current
      .filter((item) => item.label.toLowerCase().includes(query))
      .slice(0, 6);

    if (matches.length > 0) {
      setAutocompleteSuggestions(matches);
      setSelectedSuggestionIdx(0);
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  }, []);

  const handleSelectSuggestion = (item: AutocompleteItem) => {
    if (!textareaRef.current) return;
    const text = value;
    const pos = cursorPosition;
    const prefix = text.slice(0, pos);
    const suffix = text.slice(pos);

    const match = prefix.match(/[a-zA-Z0-9_-]+$/);
    const replaceStart = match ? pos - match[0].length : pos;

    const newValue = text.slice(0, replaceStart) + item.insertText + suffix;
    onChange(newValue);
    setShowAutocomplete(false);

    const newPos = replaceStart + item.insertText.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Run Query: Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      setShowAutocomplete(false);
      onExecute();
      setSrAnnouncement("Running BladeQL investigation query...");
      return;
    }

    // 2. Autocomplete navigation
    if (showAutocomplete) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev + 1) % autocompleteSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) =>
          (prev - 1 + autocompleteSuggestions.length) % autocompleteSuggestions.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = autocompleteSuggestions[selectedSuggestionIdx];
        if (selected) {
          handleSelectSuggestion(selected);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowAutocomplete(false);
        return;
      }
    }

    // 3. Query History Navigation (Alt+Up, Alt+Down)
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(nextIdx);
        onChange(history[history.length - 1 - nextIdx]);
      }
      return;
    }
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        onChange(history[history.length - 1 - nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        onChange("");
      }
      return;
    }

    // 4. Escape key unfocuses editor (no keyboard trap)
    if (e.key === "Escape" && !showAutocomplete) {
      textareaRef.current?.blur();
    }
  };

  const handleFormatQuery = () => {
    // Formats queries by placing pipeline stages on clean indented newlines
    const formatted = value
      .split("|")
      .map((part, idx) => (idx === 0 ? part.trim() : `  | ${part.trim()}`))
      .join("\n");
    onChange(formatted);
  };

  const lines = value.split("\n");

  return (
    <div className="flex flex-col bg-surface border border-line rounded-xs relative">
      {/* Screen Reader Live Announcement */}
      <div className="sr-only" aria-live="polite">
        {srAnnouncement}
        {error ? `Query Error: ${error}` : ""}
      </div>

      {/* Editor Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-line bg-surface-raised text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-cyan flex items-center gap-1">
            <span className="text-muted">bladeql&gt;</span>
          </span>
          <span className="text-muted text-[11px] hidden sm:inline">
            (Press <kbd className="px-1 py-0.5 bg-surface border border-line rounded font-mono text-[10px]">Ctrl+Enter</kbd> to run, <kbd className="px-1 py-0.5 bg-surface border border-line rounded font-mono text-[10px]">Alt+↑/↓</kbd> for history)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleFormatQuery}
            className="px-2 py-0.5 rounded-xs border border-line bg-surface hover:bg-surface-raised text-ink text-[11px] font-mono"
            title="Format pipeline commands with indentation"
          >
            Format
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            className="px-2 py-0.5 rounded-xs border border-line bg-surface hover:bg-surface-raised text-muted hover:text-ink text-[11px]"
            title="Clear query input"
          >
            Clear
          </button>
          {onExplain && (
            <button
              type="button"
              onClick={onExplain}
              className="px-2 py-0.5 rounded-xs border border-cyan/40 bg-cyan/10 hover:bg-cyan/20 text-cyan text-[11px] font-bold"
              title="Explain parsed query execution step-by-step"
            >
              Explain
            </button>
          )}
          <button
            type="button"
            onClick={onExecute}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1 rounded-xs border border-cyan bg-cyan/25 hover:bg-cyan/35 text-cyan font-bold text-xs uppercase tracking-wider disabled:opacity-50"
          >
            <IconSearch className="h-3.5 w-3.5" />
            {isLoading ? "Running..." : "Search"}
          </button>
        </div>
      </div>

      {/* Main Textarea with Line Numbers */}
      <div className="flex relative font-mono text-xs min-h-[96px] max-h-[220px]">
        {/* Line Numbers */}
        <div
          aria-hidden="true"
          className="select-none py-2 px-2 text-right text-muted/60 bg-surface border-r border-line/40 shrink-0 min-w-[28px]"
        >
          {lines.map((_, i) => (
            <div key={i} className="leading-5">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            const pos = e.target.selectionStart;
            setCursorPosition(pos);
            updateAutocomplete(e.target.value, pos);
          }}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            const pos = (e.target as HTMLTextAreaElement).selectionStart;
            setCursorPosition(pos);
            updateAutocomplete(value, pos);
          }}
          placeholder='e.g. source="auth" outcome="failure" | stats count by user | sort -count | head 10'
          aria-label="BladeQL Investigation Query Monospace Editor"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          className="w-full h-full p-2 bg-transparent text-ink font-mono resize-y outline-none leading-5 min-h-[96px]"
        />

        {/* Autocomplete Dropdown */}
        {showAutocomplete && (
          <div
            role="listbox"
            aria-label="Autocomplete suggestions"
            className="absolute left-8 bottom-[-160px] z-50 w-72 bg-surface-raised border border-cyan/40 rounded-xs shadow-xl max-h-40 overflow-y-auto font-mono text-xs"
          >
            {autocompleteSuggestions.map((item, idx) => (
              <div
                key={item.label}
                role="option"
                aria-selected={idx === selectedSuggestionIdx}
                onClick={() => handleSelectSuggestion(item)}
                className={`flex items-center justify-between px-2.5 py-1.5 cursor-pointer ${
                  idx === selectedSuggestionIdx
                    ? "bg-cyan/20 text-cyan border-l-2 border-cyan"
                    : "hover:bg-surface text-ink"
                }`}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span
                    className={`text-[9px] uppercase px-1 py-0.2 rounded font-bold ${
                      item.type === "command"
                        ? "bg-cyan/20 text-cyan"
                        : item.type === "function"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : item.type === "field"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-purple-500/20 text-purple-400"
                    }`}
                  >
                    {item.type}
                  </span>
                  <span className="font-bold truncate">{item.label}</span>
                </div>
                <span className="text-[10px] text-muted truncate max-w-[100px]">
                  {item.description}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="px-3 py-2 border-t border-danger/40 bg-danger/10 text-danger text-xs font-mono flex items-start gap-2"
        >
          <span className="font-bold shrink-0">Query Syntax Error:</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
