"use client";

export function CounterInput({ label, value, onChange, min = 0 }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 border border-structure rounded-xl bg-bg-panel w-full">
      <span className="font-medium text-xs sm:text-sm text-text-main truncate min-w-0" title={label}>
        {label}
      </span>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          aria-label={`${label} verringern`}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-bg-dark border border-structure hover:bg-structure text-text-main font-bold text-sm shrink-0 transition-colors cursor-pointer select-none active:scale-95 disabled:opacity-30"
          disabled={value <= min}
        >
          -
        </button>
        <span className="font-bold w-5 sm:w-6 text-center text-xs sm:text-sm text-text-main shrink-0 tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label={`${label} erhöhen`}
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-[#6E8F64] hover:bg-[#5C7A53] text-white font-bold text-sm shrink-0 transition-all shadow-xs cursor-pointer select-none active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
}
