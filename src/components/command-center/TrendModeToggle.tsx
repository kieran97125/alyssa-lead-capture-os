"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type { PerformanceTrendMode } from "@/lib/marketing/performanceTrend";

const STORAGE_PREFIX = "growth-os:performance-trend-mode:";

const modeCopy: Record<
  PerformanceTrendMode,
  { label: string; description: string }
> = {
  cumulative: {
    label: "累積",
    description: "由期間開始逐日加總，適合睇整體進度。",
  },
  daily: {
    label: "單日",
    description: "只顯示當日實際值，適合睇波動同異常。",
  },
};

function isTrendMode(value: string | null): value is PerformanceTrendMode {
  return value === "cumulative" || value === "daily";
}

export function useTrendModePreference(input: {
  defaultMode: PerformanceTrendMode;
  preferenceKey: string;
}) {
  const [mode, setModeState] = useState<PerformanceTrendMode>(input.defaultMode);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(
        `${STORAGE_PREFIX}${input.preferenceKey}`
      );
      if (isTrendMode(stored)) setModeState(stored);
    } catch {
      // Private browsing or restrictive browser policies may disable storage.
    }
  }, [input.preferenceKey]);

  const setMode = useCallback(
    (nextMode: PerformanceTrendMode) => {
      setModeState(nextMode);
      try {
        window.localStorage.setItem(
          `${STORAGE_PREFIX}${input.preferenceKey}`,
          nextMode
        );
      } catch {
        // The chart remains fully usable even when preference storage is blocked.
      }
    },
    [input.preferenceKey]
  );

  return [mode, setMode] as const;
}

export function TrendModeToggle({
  mode,
  onChange,
  compact = false,
}: {
  mode: PerformanceTrendMode;
  onChange: (mode: PerformanceTrendMode) => void;
  compact?: boolean;
}) {
  const descriptionId = useId();
  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${
        compact ? "" : "sm:gap-x-2.5"
      }`}
      data-testid="trend-mode-toggle"
    >
      <span className="shrink-0 text-[10px] font-extrabold tracking-[0.04em] text-[#8d7180]">
        顯示
      </span>
      <div
        role="group"
        aria-label="走勢顯示方式"
        aria-describedby={descriptionId}
        className="inline-flex w-fit rounded-[10px] border border-[#e2d3cc] bg-[#f6f1ef] p-0.5"
      >
        {(["cumulative", "daily"] as PerformanceTrendMode[]).map(
          (option) => {
            const selected = option === mode;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                data-testid={`trend-mode-${option}`}
                onClick={() => onChange(option)}
                className={`min-w-[3.65rem] rounded-[7px] px-2.5 py-1 text-[12px] font-extrabold leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a5d76]/25 ${
                  selected
                    ? "bg-[#5a2348] text-white shadow-[0_2px_6px_rgba(90,35,72,0.16)]"
                    : "text-[#745667] hover:bg-white/80 hover:text-[#5a2348]"
                }`}
              >
                {modeCopy[option].label}
              </button>
            );
          }
        )}
      </div>
      <span
        id={descriptionId}
        className={
          compact
            ? "sr-only"
            : "max-w-md text-[10px] font-semibold leading-4 text-[#8b7180]"
        }
        aria-live="polite"
      >
        {modeCopy[mode].description}
      </span>
    </div>
  );
}
