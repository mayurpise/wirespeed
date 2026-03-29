import chalk from 'chalk';
import cliSpinners from 'cli-spinners';
import { symbols, colors } from './theme.js';

const spinner = cliSpinners.dots;
let spinnerFrame = 0;

export function getSpinnerFrame(): string {
  const frame = spinner.frames[spinnerFrame % spinner.frames.length]!;
  spinnerFrame++;
  return chalk.yellow(frame);
}

export function resetSpinner(): void {
  spinnerFrame = 0;
}

export function progressBar(progress: number, width = 30): string {
  const clamped = Math.max(0, Math.min(1, progress));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  return colors.accent(symbols.bar.repeat(filled)) + colors.dim(symbols.barEmpty.repeat(empty));
}

export function box(lines: string[], width = 40): string {
  const inner = width - 2;
  const top = colors.box(
    `   ${symbols.boxTopLeft}${symbols.boxHorizontal.repeat(inner)}${symbols.boxTopRight}`,
  );
  const bottom = colors.box(
    `   ${symbols.boxBottomLeft}${symbols.boxHorizontal.repeat(inner)}${symbols.boxBottomRight}`,
  );

  const rows = lines.map(line => {
    const stripped = stripAnsi(line);
    const pad = Math.max(0, inner - stripped.length);
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return colors.box(`   ${symbols.boxVertical}`) +
      ' '.repeat(left) + line + ' '.repeat(right) +
      colors.box(symbols.boxVertical);
  });

  return [top, ...rows, bottom].join('\n');
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
