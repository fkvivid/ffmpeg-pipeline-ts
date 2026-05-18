import type { Rendition } from "../types.js";

export const DEFAULT_LADDER: Rendition[] = [
  { name: "1080p", width: 1920, height: 1080, videoBitrate: "4500k", audioBitrate: "192k", maxRate: "4950k", bufSize: "9000k" },
  { name: "720p", width: 1280, height: 720, videoBitrate: "2500k", audioBitrate: "128k", maxRate: "2750k", bufSize: "5000k" },
  { name: "480p", width: 854, height: 480, videoBitrate: "1000k", audioBitrate: "128k", maxRate: "1100k", bufSize: "2000k" },
  { name: "360p", width: 640, height: 360, videoBitrate: "500k", audioBitrate: "96k", maxRate: "550k", bufSize: "1000k" },
];

export function pickRenditions(sourceHeight: number): Rendition[] {
  const picked = DEFAULT_LADDER.filter((r) => r.height <= sourceHeight);
  return picked.length > 0 ? picked : [DEFAULT_LADDER[DEFAULT_LADDER.length - 1]];
}
