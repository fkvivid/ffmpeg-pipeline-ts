import fs from "node:fs/promises";
import path from "node:path";
import type { Rendition } from "../types.js";

function parseBitrateKbps(s: string): number {
  const v = parseInt(s.toLowerCase().replace(/k$/, "").trim(), 10);
  return v * 1000;
}

export async function writeMasterPlaylist(outputDir: string, renditions: Rendition[]): Promise<void> {
  let body = "#EXTM3U\n#EXT-X-VERSION:3\n\n";

  for (const r of renditions) {
    const bandwidth = parseBitrateKbps(r.videoBitrate) + parseBitrateKbps(r.audioBitrate);
    body += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${r.width}x${r.height},CODECS="avc1.640028,mp4a.40.2"\n`;
    body += `${r.name}/stream.m3u8\n\n`;
  }

  await fs.writeFile(path.join(outputDir, "master.m3u8"), body, "utf8");
}
