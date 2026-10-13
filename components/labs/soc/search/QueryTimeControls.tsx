"use client";

import { useState } from "react";
import { IconClock } from "@/components/ui/icons";

export interface TimeRangeConfig {
  preset: "all" | "15m" | "1h" | "4h" | "24h" | "custom";
  earliestEpochMs?: number;
  latestEpochMs?: number;
  useUtc: boolean;
}

export interface QueryTimeControlsProps {
  timeConfig: TimeRangeConfig;
  onChange: (config: TimeRangeConfig) => void;
  scenarioNowIso: string;
}

export function QueryTimeControls({
  timeConfig,
  onChange,
  scenarioNowIso,
}: QueryTimeControlsProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const scenarioNowEpoch = new Date(scenarioNowIso).getTime();

  const handleSelectPreset = (preset: TimeRangeConfig["preset"]) => {
    if (preset === "custom") {
      setIsCustomOpen(true);
      return;
    }

    setIsCustomOpen(false);

    let earliest: number | undefined = undefined;
    if (preset === "15m") earliest = scenarioNowEpoch - 15 * 60 * 1000;
    if (preset === "1h") earliest = scenarioNowEpoch - 60 * 60 * 1000;
    if (preset === "4h") earliest = scenarioNowEpoch - 4 * 60 * 60 * 1000;
    if (preset === "24h") earliest = scenarioNowEpoch - 24 * 60 * 60 * 1000;

    onChange({
      ...timeConfig,
      preset,
      earliestEpochMs: earliest,
      latestEpochMs: preset === "all" ? undefined : scenarioNowEpoch,
    });
  };

  const handleToggleUtc = () => {
    onChange({
      ...timeConfig,
      useUtc: !timeConfig.useUtc,
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-surface border-b border-line text-xs">
      {/* Preset Buttons */}
      <div className="flex items-center gap-1">
        <span className="text-muted flex items-center gap-1 font-bold mr-1">
          <IconClock className="h-3.5 w-3.5 text-cyan" />
          <span>Window:</span>
        </span>

        {(["all", "15m", "1h", "4h", "24h"] as const).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handleSelectPreset(preset)}
            className={`px-2 py-0.5 rounded-xs font-mono text-[11px] border transition-colors ${
              timeConfig.preset === preset
                ? "bg-cyan/20 border-cyan text-cyan font-bold"
                : "border-line bg-surface hover:bg-surface-raised text-muted hover:text-ink"
            }`}
          >
            {preset === "all" ? "All Time" : preset}
          </button>
        ))}
      </div>

      {/* Timezone Toggle & Scenario Reference */}
      <div className="flex items-center gap-2">
        <span className="text-muted text-[11px] hidden sm:inline">
          Scenario Now: <span className="font-mono text-ink">{scenarioNowIso.slice(0, 19)}Z</span>
        </span>

        <button
          type="button"
          onClick={handleToggleUtc}
          className="px-2 py-0.5 rounded-xs border border-line bg-surface hover:bg-surface-raised text-muted hover:text-ink text-[11px] font-mono"
          title="Toggle between UTC and local time display"
        >
          {timeConfig.useUtc ? "Display: UTC" : "Display: Local"}
        </button>
      </div>
    </div>
  );
}
