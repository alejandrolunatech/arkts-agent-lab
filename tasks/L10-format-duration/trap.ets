const pad = (value: number) => String(value).padStart(2, '0');

function render(hours: number, minutes: number, seconds: number) {
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}

function formatPositive(total: number) {
  return render(Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60);
}

export function formatDuration(totalSeconds: number): string {
  return totalSeconds < 0 ? `-${formatPositive(-totalSeconds)}` : formatPositive(totalSeconds);
}

const unitSeconds = (unit: string) => (unit === 'h' ? 3600 : unit === 'm' ? 60 : 1);

export function parseDuration(text: string): number {
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  let total = 0;
  for (const part of body.split(' ')) {
    const match = /^(\d+)([hms])$/.exec(part);
    if (!match) return NaN;
    total += +match[1] * unitSeconds(match[2]);
  }
  return negative ? -total : total;
}
