const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

function twoDigits(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) {
    return `-${formatDuration(-totalSeconds)}`;
  }
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (hours > 0) {
    return `${hours}h ${twoDigits(minutes)}m ${twoDigits(seconds)}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${twoDigits(seconds)}s`;
  }
  return `${seconds}s`;
}

function secondsPerUnit(unit: string): number {
  switch (unit) {
    case 'h':
      return SECONDS_PER_HOUR;
    case 'm':
      return SECONDS_PER_MINUTE;
    case 's':
      return 1;
    default:
      return Number.NaN;
  }
}

function isDigits(text: string): boolean {
  if (text.length === 0) {
    return false;
  }
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (char < '0' || char > '9') {
      return false;
    }
  }
  return true;
}

export function parseDuration(text: string): number {
  const negative = text.startsWith('-');
  const body = negative ? text.substring(1) : text;
  let total = 0;
  for (const part of body.split(' ')) {
    const digits = part.substring(0, part.length - 1);
    const factor = secondsPerUnit(part.charAt(part.length - 1));
    if (!isDigits(digits) || Number.isNaN(factor)) {
      return Number.NaN;
    }
    total += Number.parseInt(digits, 10) * factor;
  }
  return negative ? -total : total;
}
