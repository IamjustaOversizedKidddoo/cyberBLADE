"use client";

import { useState } from "react";
import type { IocRowData, IocType, IocRole } from "@/lib/lab-engine/soc/reports/types";
import { defangIndicator } from "@/lib/lab-engine/soc/reports/sanitizer";

interface Props {
  iocs: IocRowData[];
  onChange: (updated: IocRowData[]) => void;
  disabled?: boolean;
}

const IOC_TYPES: { value: IocType; label: string }[] = [
  { value: "ip", label: "IP Address" },
  { value: "domain", label: "Domain / FQDN" },
  { value: "hash", label: "File Hash (SHA256/MD5)" },
  { value: "url", label: "URL / Web Address" },
  { value: "file_path", label: "File Path" },
  { value: "email", label: "Email Address" },
  { value: "user", label: "User Account" },
  { value: "host", label: "Host / Machine" },
  { value: "process", label: "Process Name / Command" },
  { value: "other", label: "Other Indicator" },
];

const IOC_ROLES: { value: IocRole; label: string }[] = [
  { value: "c2", label: "Command & Control (C2)" },
  { value: "delivery", label: "Delivery / Phishing" },
  { value: "victim", label: "Victim / Target" },
  { value: "staging", label: "Staging / Intermediate" },
  { value: "persistence", label: "Persistence Mechanism" },
  { value: "lateral_movement", label: "Lateral Movement" },
  { value: "exfiltration", label: "Exfiltration" },
  { value: "unrelated_benign", label: "Benign / Noise" },
  { value: "other", label: "Other Suspicious" },
];

export function IocTableEditor({ iocs, onChange, disabled }: Props) {
  const [newType, setNewType] = useState<IocType>("ip");
  const [newValue, setNewValue] = useState("");
  const [newRole, setNewRole] = useState<IocRole>("c2");
  const [newNotes, setNewNotes] = useState("");

  const handleAddRow = () => {
    if (!newValue.trim()) return;
    const defanged = defangIndicator(newValue.trim());
    const newRow: IocRowData = {
      id: `ioc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: newType,
      value: defanged,
      defangedValue: defanged,
      role: newRole,
      notes: newNotes.trim() || undefined,
      evidenceRefs: [],
    };
    onChange([...iocs, newRow]);
    setNewValue("");
    setNewNotes("");
  };

  const handleDeleteRow = (id: string) => {
    onChange(iocs.filter((i) => i.id !== id));
  };

  const handleUpdateRow = (id: string, partial: Partial<IocRowData>) => {
    onChange(
      iocs.map((i) => {
        if (i.id !== id) return i;
        const updated = { ...i, ...partial };
        if (partial.value !== undefined) {
          updated.defangedValue = defangIndicator(partial.value);
        }
        return updated;
      }),
    );
  };

  const handleDefangRow = (id: string) => {
    const row = iocs.find((i) => i.id === id);
    if (!row) return;
    handleUpdateRow(id, { value: defangIndicator(row.value) });
  };

  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold uppercase tracking-wider text-muted text-[11px]">
          Extracted Indicators ({iocs.length})
        </span>
        <span className="text-[10px] text-muted">
          All IPs and domains should be defanged (e.g. 192[.]0[.]2[.]1)
        </span>
      </div>

      {/* Existing IoCs Table */}
      <div
        className="overflow-x-auto rounded-xs border border-line bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        // Scrollable table: focusable so keyboard users can scroll it (WCAG 2.1.1).
        tabIndex={0}
        role="region"
        aria-label="Indicators of compromise table (scrolls sideways)"
      >
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-line bg-surface-raised text-[10px] uppercase tracking-wider text-muted">
              <th className="p-2 w-28">Type</th>
              <th className="p-2">Indicator Value</th>
              <th className="p-2 w-44">Observed Role</th>
              <th className="p-2">Notes</th>
              <th className="p-2 w-20 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {iocs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted italic">
                  No indicators added yet. Use the form below to record validated IoCs.
                </td>
              </tr>
            ) : (
              iocs.map((ioc) => {
                const isDefanged = ioc.value.includes("[.]") || ioc.value.includes("hxxp");
                return (
                  <tr key={ioc.id} className="hover:bg-surface-raised/40">
                    <td className="p-2">
                      <select
                        value={ioc.type}
                        disabled={disabled}
                        onChange={(e) => handleUpdateRow(ioc.id, { type: e.target.value as IocType })}
                        aria-label="Indicator Type"
                        className="w-full rounded-xs border border-line bg-surface px-1.5 py-1 text-xs text-ink"
                      >
                        {IOC_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={ioc.value}
                          disabled={disabled}
                          onChange={(e) => handleUpdateRow(ioc.id, { value: e.target.value })}
                          aria-label="Indicator Value"
                          className="w-full rounded-xs border border-line bg-surface px-2 py-1 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                        />
                        {!isDefanged && (
                          <button
                            type="button"
                            onClick={() => handleDefangRow(ioc.id)}
                            disabled={disabled}
                            title="Quick defang indicator"
                            className="rounded-xs border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold text-warning hover:bg-warning/20 whitespace-nowrap"
                          >
                            Defang
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <select
                        value={ioc.role}
                        disabled={disabled}
                        onChange={(e) => handleUpdateRow(ioc.id, { role: e.target.value as IocRole })}
                        aria-label="Observed Role"
                        className="w-full rounded-xs border border-line bg-surface px-1.5 py-1 text-xs text-ink"
                      >
                        {IOC_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={ioc.notes ?? ""}
                        placeholder="Context or source alert..."
                        disabled={disabled}
                        onChange={(e) => handleUpdateRow(ioc.id, { notes: e.target.value })}
                        aria-label="Indicator Notes"
                        className="w-full rounded-xs border border-line bg-surface px-2 py-1 text-muted focus:text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(ioc.id)}
                        disabled={disabled}
                        className="text-error hover:underline px-1 py-0.5"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add New IoC Form */}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 rounded-xs border border-line bg-surface-raised p-2.5">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as IocType)}
            aria-label="New Indicator Type"
            className="rounded-xs border border-line bg-surface px-2 py-1 text-xs text-ink"
          >
            {IOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddRow();
              }
            }}
            aria-label="New Indicator Value"
            placeholder="Enter indicator (e.g. 198.51.100.24 or evil.xyz)..."
            className="flex-1 min-w-[200px] rounded-xs border border-line bg-surface px-2.5 py-1 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          />

          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as IocRole)}
            aria-label="New Indicator Role"
            className="rounded-xs border border-line bg-surface px-2 py-1 text-xs text-ink"
          >
            {IOC_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            aria-label="New Indicator Notes"
            placeholder="Notes (optional)..."
            className="w-44 rounded-xs border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          />

          <button
            type="button"
            onClick={handleAddRow}
            disabled={!newValue.trim()}
            className="rounded-xs border border-cyan/40 bg-cyan/15 px-3 py-1 font-bold text-cyan hover:bg-cyan/25 disabled:opacity-50"
          >
            + Add Indicator
          </button>
        </div>
      )}
    </div>
  );
}
