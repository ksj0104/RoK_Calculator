import { useState } from 'react';

/** 레벨 입력: [−][직접 입력][+]. 직접 입력은 0~max로 제한되고, 비우는 중에는 0으로 튀지 않는다. */
export function LevelStepper({ value, max, label, onChange }: {
  value: number; max: number; label: string; onChange: (level: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => (Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0);

  const type = (raw: string) => {
    if (raw === '') { setDraft(''); return; }
    setDraft(null);
    onChange(clamp(Number(raw)));
  };

  return (
    <span className="level-stepper">
      <button type="button" className="step-down" aria-label={`${label} −1`}
        disabled={value <= 0} onClick={() => onChange(clamp(value - 1))}>−</button>
      <input type="number" inputMode="numeric" min={0} max={max} aria-label={label}
        value={draft ?? value}
        onChange={(event) => type(event.target.value)}
        onBlur={() => setDraft(null)} />
      <button type="button" className="step-up" aria-label={`${label} +1`}
        disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>+</button>
    </span>
  );
}
