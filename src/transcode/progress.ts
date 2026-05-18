import type { Progress } from "../types.js";

const reTime = /time=(\d+):(\d+):(\d+\.\d+)/;
const reFps = /fps=\s*([\d.]+)/;
const reSpeed = /speed=\s*([\d.]+)x/;

export function parseProgress(line: string, rendition: string, duration: number): Progress | null {
  if (!line.includes("time=")) return null;

  const p: Progress = { rendition, percent: 0, fps: 0, speed: 0, done: false };

  const tm = line.match(reTime);
  if (tm && duration > 0) {
    const current = parseFloat(tm[1]) * 3600 + parseFloat(tm[2]) * 60 + parseFloat(tm[3]);
    p.percent = Math.min((current / duration) * 100, 99);
  }

  const fm = line.match(reFps);
  if (fm) p.fps = parseFloat(fm[1]);

  const sm = line.match(reSpeed);
  if (sm) p.speed = parseFloat(sm[1]);

  return p;
}
