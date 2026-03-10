/**
 * Shared 12-hour AM/PM time picker.
 * - value / onChange use "HH:MM" 24-hour strings (matches DB storage)
 * - User only ever sees/selects 12-hour + AM/PM — no 24-hour confusion
 */
import React from 'react';

interface TimePickerFieldProps {
  value: string; // "HH:MM" 24h or ""
  onChange: (val: string) => void; // emits "HH:MM" 24h or ""
  label?: string;
  optional?: boolean;
  error?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

function to12h(value: string): { hour: string; minute: string; ampm: 'AM' | 'PM' } {
  if (!value) return { hour: '', minute: '', ampm: 'AM' };
  const [hStr, mStr] = value.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h = h - 12;
  return { hour: String(h), minute: String(m).padStart(2, '0'), ampm };
}

function to24h(hour: string, minute: string, ampm: 'AM' | 'PM'): string {
  if (!hour || !minute) return '';
  let h = parseInt(hour, 10);
  if (ampm === 'AM' && h === 12) h = 0;
  else if (ampm === 'PM' && h !== 12) h = h + 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const selectCls =
  'flex-1 px-2 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer appearance-none text-center';

export function TimePickerField({ value, onChange, label, optional, error }: TimePickerFieldProps) {
  const { hour, minute, ampm } = to12h(value);

  const handleChange = (field: 'hour' | 'minute' | 'ampm', val: string) => {
    const newHour   = field === 'hour'   ? val : hour;
    const newMinute = field === 'minute' ? val : minute;
    const newAmpm   = field === 'ampm'   ? (val as 'AM' | 'PM') : ampm;
    if (!newHour || !newMinute) { onChange(''); return; }
    onChange(to24h(newHour, newMinute, newAmpm));
  };

  const clear = () => onChange('');

  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-foreground mb-1.5">
          {label}
          {optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
        </label>
      )}
      <div className="flex items-center gap-1.5">
        {/* Hour */}
        <select
          value={hour}
          onChange={(e) => handleChange('hour', e.target.value)}
          className={selectCls + (error ? ' border-destructive' : '')}
          aria-label="Hour"
        >
          <option value="">Hr</option>
          {HOURS.map((h) => (
            <option key={h} value={String(h)}>{String(h).padStart(2, '0')}</option>
          ))}
        </select>

        <span className="text-foreground font-bold text-sm select-none">:</span>

        {/* Minute */}
        <select
          value={minute}
          onChange={(e) => handleChange('minute', e.target.value)}
          className={selectCls + (error ? ' border-destructive' : '')}
          aria-label="Minute"
        >
          <option value="">Min</option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* AM / PM */}
        <select
          value={ampm}
          onChange={(e) => handleChange('ampm', e.target.value)}
          className={selectCls + (error ? ' border-destructive' : '') + ' max-w-[64px]'}
          aria-label="AM or PM"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>

        {/* Clear */}
        {value && (
          <button
            type="button"
            onClick={clear}
            className="px-2 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs font-semibold shrink-0"
            aria-label="Clear time"
          >
            ✕
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
