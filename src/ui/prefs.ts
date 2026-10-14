// UI preferences (not part of GameState). Stored in localStorage; every access is guarded.
const DAY_NIGHT_KEY = 'pawpark.pref.dayNight';

/** Whether the park's time-of-day tint follows the device clock (default: on). */
export function getDayNight(): boolean {
  try {
    return localStorage.getItem(DAY_NIGHT_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setDayNight(on: boolean): void {
  try {
    localStorage.setItem(DAY_NIGHT_KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable: preference lasts for this session only */
  }
}
