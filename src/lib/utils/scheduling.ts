/**
 * Scheduling & Time Slot Utilities for Sahayak
 * Enforces Asia/Kolkata timezone calculations, strictly individual (non-duration) booking times,
 * dynamic urgency-based slot generation, and past-time exclusion.
 */

export const ASIA_KOLKATA_TZ = 'Asia/Kolkata';

export interface TimeOption {
  time: string;          // e.g. "2:00 PM"
  value: string;         // e.g. "2:00 PM" (alias)
  label: string;         // e.g. "2:00 PM" (alias)
  hour24: number;        // e.g. 14
  minute: number;        // e.g. 0
  isEmergencyWindow?: boolean; // Within 1-2 hours for emergency priority
  isPriority?: boolean;  // alias for isEmergencyWindow
  tag?: string;          // e.g. "Earliest Available"
  hint?: string;         // alias for tag
}

export interface DateOption {
  dateString: string;    // YYYY-MM-DD
  dateStr: string;       // YYYY-MM-DD (alias)
  displayLabel: string;  // e.g. "Tomorrow (Fri, 6 Nov)"
  label: string;         // e.g. "Tomorrow"
  sub: string;           // e.g. "Fri, 6 Nov"
  dayName: string;       // e.g. "Friday"
  isToday: boolean;
}

/**
 * Gets the current Date & Time broken down in Asia/Kolkata.
 */
export function getKolkataNow(referenceDate: Date = new Date()): {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hours: number; // 0-23
  minutes: number; // 0-59
  dateString: string; // YYYY-MM-DD
  dateStr: string;    // YYYY-MM-DD (alias)
  kolkataDate: Date;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ASIA_KOLKATA_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(referenceDate);

  const lookup: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      lookup[p.type] = parseInt(p.value, 10);
    }
  }

  const year = lookup['year'] || referenceDate.getFullYear();
  const month = lookup['month'] || (referenceDate.getMonth() + 1);
  const day = lookup['day'] || referenceDate.getDate();
  const hours = lookup['hour'] !== undefined ? lookup['hour'] : referenceDate.getHours();
  const minutes = lookup['minute'] !== undefined ? lookup['minute'] : referenceDate.getMinutes();

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const dateString = `${year}-${mm}-${dd}`;
  const kolkataDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  return { year, month, day, hours, minutes, dateString, dateStr: dateString, kolkataDate };
}

/**
 * Converts hour and minute to standard 12-hour display string (e.g. "9:00 AM", "1:30 PM").
 * Strictly individual time, NEVER a range (no "4:00 PM - 5:00 PM").
 */
export function formatTime12h(hour24: number, minute: number = 0): string {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const displayHour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const displayMinute = String(minute).padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Returns available date choices for "Standard" urgency (next 2-3 days).
 * Allows passing either number of days (default 3) or a reference Date.
 */
export function getStandardDateOptions(
  countOrReference?: number | Date,
  referenceDateInput?: Date
): DateOption[] {
  let count = 3;
  let refDate = new Date();
  if (typeof countOrReference === 'number') {
    count = countOrReference;
    if (referenceDateInput instanceof Date) refDate = referenceDateInput;
  } else if (countOrReference instanceof Date) {
    refDate = countOrReference;
  }

  const now = getKolkataNow(refDate);
  const options: DateOption[] = [];

  // Generate tomorrow and subsequent days
  for (let offset = 1; offset <= count; offset++) {
    // Construct local midday in Kolkata and advance by offset days
    const target = new Date(Date.UTC(now.year, now.month - 1, now.day + offset, 12, 0, 0));
    const targetParts = getKolkataNow(target);

    const weekday = new Intl.DateTimeFormat('en-IN', {
      timeZone: ASIA_KOLKATA_TZ,
      weekday: 'short',
    }).format(target);

    const monthShort = new Intl.DateTimeFormat('en-IN', {
      timeZone: ASIA_KOLKATA_TZ,
      month: 'short',
    }).format(target);

    let prefix = '';
    if (offset === 1) prefix = 'Tomorrow';
    else if (offset === 2) prefix = 'In 2 Days';
    else if (offset === 3) prefix = 'In 3 Days';
    else prefix = `In ${offset} Days`;

    const sub = `${weekday}, ${targetParts.day} ${monthShort}`;

    options.push({
      dateString: targetParts.dateString,
      dateStr: targetParts.dateString,
      displayLabel: `${prefix} (${sub})`,
      label: prefix,
      sub,
      dayName: weekday,
      isToday: false,
    });
  }

  return options;
}

/**
 * Returns individual booking times for a given date under "Standard" urgency.
 * Standard operating hours: 9:00 AM to 8:00 PM.
 */
export function getStandardTimeOptions(
  selectedDateOrRef?: string | Date,
  referenceDateInput?: Date
): TimeOption[] {
  let selectedDateStr = '';
  let refDate = new Date();

  if (typeof selectedDateOrRef === 'string') {
    selectedDateStr = selectedDateOrRef;
    if (referenceDateInput instanceof Date) refDate = referenceDateInput;
  } else if (selectedDateOrRef instanceof Date) {
    refDate = selectedDateOrRef;
  }

  const now = getKolkataNow(refDate);
  const isSelectedToday = selectedDateStr ? selectedDateStr === now.dateString : false;

  const times: TimeOption[] = [];
  // Standard operating hours: 9 AM (09:00) to 8 PM (20:00)
  for (let h = 9; h <= 20; h++) {
    // If today is chosen, skip times that have already passed (allow at least 15 mins buffer)
    if (isSelectedToday) {
      if (h < now.hours || (h === now.hours && now.minutes > 15)) {
        continue;
      }
    }

    const t = formatTime12h(h, 0);
    times.push({
      time: t,
      value: t,
      label: t,
      hour24: h,
      minute: 0,
      isEmergencyWindow: false,
      isPriority: false,
    });
  }

  return times;
}

/**
 * Returns upcoming individual booking times for "Same Day" urgency.
 * Filters out all past times today.
 */
export function getSameDayTimeOptions(referenceDate: Date = new Date()): TimeOption[] {
  const now = getKolkataNow(referenceDate);
  const times: TimeOption[] = [];

  // Start from next upcoming hour or half-hour up to 21:00 (9:00 PM)
  const currentTotalMinutes = now.hours * 60 + now.minutes;

  // Hourly slots from 8 AM to 9 PM
  for (let h = 8; h <= 21; h++) {
    const slotMinutes = h * 60;
    // Must be in the future (minimum 15 mins advance notice)
    if (slotMinutes > currentTotalMinutes + 15) {
      const t = formatTime12h(h, 0);
      times.push({
        time: t,
        value: t,
        label: t,
        hour24: h,
        minute: 0,
        isEmergencyWindow: false,
        isPriority: false,
      });
    }
  }

  return times;
}

/**
 * Calculates the immediate emergency arrival window (within 1-2 hours) based on Kolkata time.
 * E.g., at 12:30 PM -> "1:00 PM – 2:00 PM"
 */
export function getEmergencyArrivalWindow(referenceDate: Date = new Date()): {
  startTime: string;
  endTime: string;
  displayWindow: string;
  slotValue: string;
} {
  const now = getKolkataNow(referenceDate);
  const currentTotalMinutes = now.hours * 60 + now.minutes;

  // Round up to nearest 30 mins with at least 15 mins buffer
  const startMin = Math.ceil((currentTotalMinutes + 15) / 30) * 30;
  const endMin = startMin + 60; // 1-hour arrival window

  const startHour = Math.floor(startMin / 60) % 24;
  const startMinute = startMin % 60;
  const endHour = Math.floor(endMin / 60) % 24;
  const endMinute = endMin % 60;

  const startTime = formatTime12h(startHour, startMinute);
  const endTime = formatTime12h(endHour, endMinute);

  return {
    startTime,
    endTime,
    displayWindow: `${startTime} – ${endTime}`,
    slotValue: startTime,
  };
}

/**
 * Returns individual booking times for "Emergency" urgency.
 * Prioritizes the earliest times (within 1-2 hours) while allowing later slots today.
 */
export function getEmergencyTimeOptions(referenceDate: Date = new Date()): TimeOption[] {
  const now = getKolkataNow(referenceDate);
  const times: TimeOption[] = [];
  const currentTotalMinutes = now.hours * 60 + now.minutes;

  // Emergency slots are generated in 30-min increments for the immediate 2 hours,
  // then hourly for later times up to 10:00 PM (22:00)
  const emergencyWindowEndMinutes = currentTotalMinutes + 120; // within 2 hours

  // Calculate first candidate at next 30-min boundary
  let nextCandidateMin = Math.ceil((currentTotalMinutes + 20) / 30) * 30;

  let isFirst = true;
  while (nextCandidateMin <= 22 * 60) {
    const hour = Math.floor(nextCandidateMin / 60);
    const minute = nextCandidateMin % 60;

    const inEmergencyWindow = nextCandidateMin <= emergencyWindowEndMinutes;
    const tag = isFirst ? 'Earliest (~30-45 mins)' : inEmergencyWindow ? 'Within 1–2 hrs' : undefined;

    const t = formatTime12h(hour, minute);
    times.push({
      time: t,
      value: t,
      label: t,
      hour24: hour,
      minute,
      isEmergencyWindow: inEmergencyWindow,
      isPriority: inEmergencyWindow,
      tag,
      hint: tag,
    });

    isFirst = false;

    // After 2 hours window, jump by 60 mins instead of 30 mins
    if (nextCandidateMin < emergencyWindowEndMinutes) {
      nextCandidateMin += 30;
    } else {
      nextCandidateMin += 60;
    }
  }

  return times;
}

/**
 * Formats date and time into a polished customer-facing string.
 * Example: "Fri, 6 Nov, 2026 at 11:00 AM"
 */
export function formatScheduledDisplay(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr && !timeStr) return 'Not scheduled';
  if (!dateStr) return timeStr || 'Not scheduled';

  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return `${dateStr}${timeStr ? ` at ${timeStr}` : ''}`;
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const formattedDate = new Intl.DateTimeFormat('en-IN', {
      timeZone: ASIA_KOLKATA_TZ,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dt);

    return timeStr ? `${formattedDate} at ${timeStr}` : formattedDate;
  } catch {
    return `${dateStr}${timeStr ? ` at ${timeStr}` : ''}`;
  }
}
