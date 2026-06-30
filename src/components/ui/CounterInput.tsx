"use client";

export function CounterInput({ label, value, onChange, min = 0 }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between p-3 border border-structure rounded-xl bg-bg-dark">
      <span className="font-medium text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`${label} verringern`}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="btn-secondary py-0.5 px-2"
        >
          -
        </button>
        <span className="font-bold w-4 text-center">{value}</span>
        <button
          type="button"
          aria-label={`${label} erhöhen`}
          onClick={() => onChange(value + 1)}
          className="btn-secondary py-0.5 px-2"
        >
          +
        </button>
      </div>
    </div>
  );
}
