import chalk from 'chalk';
import isUnicodeSupported from 'is-unicode-supported';

const unicode = isUnicodeSupported();

export const symbols = {
  download: unicode ? '↓' : 'D',
  upload: unicode ? '↑' : 'U',
  latency: unicode ? '⏱' : 'P',
  check: unicode ? '✓' : 'ok',
  cross: unicode ? '✗' : 'x',
  bar: unicode ? '█' : '#',
  barEmpty: unicode ? '░' : '-',
  boxTopLeft: unicode ? '╭' : '+',
  boxTopRight: unicode ? '╮' : '+',
  boxBottomLeft: unicode ? '╰' : '+',
  boxBottomRight: unicode ? '╯' : '+',
  boxHorizontal: unicode ? '─' : '-',
  boxVertical: unicode ? '│' : '|',
  bullet: unicode ? '•' : '*',
};

export const colors = {
  download: chalk.bold.cyan,
  upload: chalk.bold.magenta,
  latencyGood: chalk.bold.green,
  latencyMed: chalk.bold.yellow,
  latencyBad: chalk.bold.red,
  label: chalk.bold.white,
  dim: chalk.gray,
  accent: chalk.cyan,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  speed: chalk.bold.white,
  header: chalk.bold.cyan,
  box: chalk.gray,
};

export function latencyColor(ms: number): (text: string) => string {
  if (ms < 50) return colors.latencyGood;
  if (ms < 100) return colors.latencyMed;
  return colors.latencyBad;
}
