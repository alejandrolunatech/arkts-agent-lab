// Draws the pass rates of a results file as one SVG: a small panel per model, a bar per
// condition, and the 95 % interval of each rate as a line. Like the report, it only counts
// what is in the file, and the same file always gives the same picture.

import type { Attempt } from '../agent/attempt.ts';
import { CONDITION_IDS, type ConditionId } from '../agent/conditions.ts';
import { wilson } from './report.ts';
import { counted } from './run.ts';

// One hue for every bar: the condition is named under each bar, so colour has no identity to carry.
const BAR = '#2a78d6';
const SURFACE = '#fcfcfb';
const BORDER = '#e1e0d9';
const GRID = '#e1e0d9';
const BASELINE = '#c3c2b7';
const INK = '#0b0b0b';
const INK_SECONDARY = '#52514e';
const INK_MUTED = '#898781';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const PANELS_PER_ROW = 3;
const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 208;
const MARGIN = 24;
const HEADER = 64;
const PLOT_LEFT = 40;
const PLOT_TOP = 34;
const PLOT_HEIGHT = 120;
const BAR_WIDTH = 24;
const BAR_STEP = 46;

const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const px = (value: number): string => String(Math.round(value * 10) / 10);

/** A bar that is square at the baseline and rounded at its data end. */
function barPath(x: number, baseline: number, height: number): string {
  if (height <= 0) return '';
  const r = Math.min(4, height, BAR_WIDTH / 2);
  const top = baseline - height;
  return `M${px(x)},${px(baseline)}V${px(top + r)}Q${px(x)},${px(top)} ${px(x + r)},${px(top)}H${px(x + BAR_WIDTH - r)}Q${px(x + BAR_WIDTH)},${px(top)} ${px(x + BAR_WIDTH)},${px(top + r)}V${px(baseline)}Z`;
}

export function passRateChart(all: Attempt[]): string {
  const attempts = counted(all);
  const models = [...new Set(attempts.map((a) => a.model))];
  const conditions: ConditionId[] = CONDITION_IDS.filter((c) => attempts.some((a) => a.condition === c));
  const tasks = new Set(attempts.map((a) => a.task)).size;
  const simulated = all.some((a) => a.simulated);

  const rows = Math.max(1, Math.ceil(models.length / PANELS_PER_ROW));
  const columns = Math.max(1, Math.min(PANELS_PER_ROW, models.length));
  const width = MARGIN * 2 + columns * PANEL_WIDTH;
  const height = HEADER + rows * PANEL_HEIGHT + MARGIN;

  const title = simulated ? 'Simulated run: scripted stand-ins, not models' : 'Pass rate by model and condition';
  const subtitle = `${attempts.length} attempts on ${tasks} tasks. Bar: share of tasks passed. Line: its 95 % interval.`;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" font-family='${FONT}'>`);
  out.push(`<title>${escape(title)}</title>`);
  out.push(`<desc>${escape(`${subtitle} The same numbers are in the table of the report.`)}</desc>`);
  out.push(`<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="${SURFACE}" stroke="${BORDER}"/>`);
  out.push(`<text x="${MARGIN}" y="30" font-size="16" font-weight="600" fill="${INK}">${escape(title)}</text>`);
  out.push(`<text x="${MARGIN}" y="50" font-size="12" fill="${INK_SECONDARY}">${escape(subtitle)}</text>`);

  models.forEach((model, index) => {
    const left = MARGIN + (index % PANELS_PER_ROW) * PANEL_WIDTH;
    const top = HEADER + Math.floor(index / PANELS_PER_ROW) * PANEL_HEIGHT;
    const baseline = top + PLOT_TOP + PLOT_HEIGHT;
    const plotRight = left + PLOT_LEFT + conditions.length * BAR_STEP;
    out.push(`<g>`);
    out.push(`<text x="${left}" y="${top + 16}" font-size="12" font-weight="600" fill="${INK}">${escape(model)}</text>`);
    for (const tick of [0, 50, 100]) {
      const y = baseline - (tick / 100) * PLOT_HEIGHT;
      out.push(`<line x1="${left + PLOT_LEFT}" x2="${plotRight}" y1="${px(y)}" y2="${px(y)}" stroke="${tick === 0 ? BASELINE : GRID}" stroke-width="1"/>`);
      out.push(`<text x="${left + PLOT_LEFT - 6}" y="${px(y + 4)}" font-size="11" text-anchor="end" fill="${INK_MUTED}">${tick}%</text>`);
    }
    conditions.forEach((c, position) => {
      const cell = attempts.filter((a) => a.model === model && a.condition === c);
      const x = left + PLOT_LEFT + position * BAR_STEP + (BAR_STEP - BAR_WIDTH) / 2;
      const middle = x + BAR_WIDTH / 2;
      out.push(`<text x="${px(middle)}" y="${baseline + 16}" font-size="11" text-anchor="middle" fill="${INK_SECONDARY}">${c}</text>`);
      if (cell.length === 0) return;
      const passed = cell.filter((a) => a.passed).length;
      const rate = passed / cell.length;
      const { low, high } = wilson(passed, cell.length);
      const label = `${model}, ${c}: ${Math.round(rate * 100)}% (${passed}/${cell.length}), 95 % interval ${low}-${high}%`;
      out.push(`<g><title>${escape(label)}</title>`);
      const path = barPath(x, baseline, rate * PLOT_HEIGHT);
      if (path) out.push(`<path d="${path}" fill="${BAR}"/>`);
      const yLow = baseline - (low / 100) * PLOT_HEIGHT;
      const yHigh = baseline - (high / 100) * PLOT_HEIGHT;
      out.push(`<path d="M${px(middle)},${px(yLow)}V${px(yHigh)}M${px(middle - 4)},${px(yLow)}h8M${px(middle - 4)},${px(yHigh)}h8" stroke="${INK}" stroke-width="1" fill="none"/>`);
      out.push(`</g>`);
    });
    out.push(`</g>`);
  });

  out.push(`</svg>`);
  return `${out.join('\n')}\n`;
}
