const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Safely parses any date format (ISO, Unix, custom Month-Day-Year strings) into a JavaScript Date.
 * Avoids returning "Invalid Date" under strict JS engines (like Hermes on React Native).
 */
export function parseDateSafe(dateVal: any): Date {
  if (!dateVal) return new Date();

  // 1. Check if it's already a Date object
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? new Date() : dateVal;
  }

  // 2. Check if it's a number (timestamp)
  if (typeof dateVal === 'number') {
    // If block timestamp in seconds, convert to ms
    if (dateVal < 10000000000) {
      return new Date(dateVal * 1000);
    }
    return new Date(dateVal);
  }

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return new Date();

    // 3. Check if it's a numeric string
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      if (num < 10000000000) {
        return new Date(num * 1000);
      }
      return new Date(num);
    }

    // 4. Try parsing as standard ISO (highly supported by Hermes)
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // 5. Manual parse for Month Day Year (e.g. "Jun 17, 2026" or "Jun 17, 2026, 12:58 PM")
    const monthsMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };

    const match = trimmed.match(/([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/);
    if (match) {
      const monthName = match[1].toLowerCase();
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);

      if (monthName in monthsMap) {
        const month = monthsMap[monthName];
        let hour = 0;
        let minute = 0;

        // Check for time details (e.g. "12:58 PM" or "14:30")
        const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
        if (timeMatch) {
          hour = parseInt(timeMatch[1], 10);
          minute = parseInt(timeMatch[2], 10);
          const ampm = timeMatch[3];
          if (ampm) {
            if (ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
            if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
          }
        }
        return new Date(year, month, day, hour, minute);
      }
    }
  }

  return new Date();
}

/**
 * Formats a date value safely into a short string: e.g. "Jun 17, 12:58 PM"
 */
export function formatDateShort(dateVal: any): string {
  try {
    const d = parseDateSafe(dateVal);
    const month = MONTHS[d.getMonth()];
    const day = d.getDate();
    let hour = d.getHours();
    const minute = d.getMinutes();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;
    const minStr = minute < 10 ? '0' + minute : minute;
    return `${month} ${day}, ${hour}:${minStr} ${ampm}`;
  } catch {
    return String(dateVal);
  }
}

/**
 * Formats a date value safely into a long string: e.g. "Jun 17, 2026 12:58 PM"
 */
export function formatDateLong(dateVal: any): string {
  try {
    const d = parseDateSafe(dateVal);
    const month = MONTHS[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    let hour = d.getHours();
    const minute = d.getMinutes();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;
    const minStr = minute < 10 ? '0' + minute : minute;
    return `${month} ${day}, ${year} ${hour}:${minStr} ${ampm}`;
  } catch {
    return String(dateVal);
  }
}
