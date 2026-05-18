import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import type { EventBroker } from "../events/broker.js";
import type { Progress, Rendition } from "../types.js";
import { parseProgress } from "./progress.js";
import { writeMasterPlaylist } from "./playlist.js";

async function transcodeOne(
  inputPath: string,
  outputDir: string,
  r: Rendition,
  duration: number,
  onProgress: (p: Progress) => void
): Promise<void> {
  const renditionDir = path.join(outputDir, r.name);
  await fs.mkdir(renditionDir, { recursive: true });

  const segmentPattern = path.join(renditionDir, "seg%05d.ts");
  const playlistPath = path.join(renditionDir, "stream.m3u8");
  const scaleFilter = `scale=w=${r.width}:h=${r.height}:force_original_aspect_ratio=decrease,pad=${r.width}:${r.height}:(ow-iw)/2:(oh-ih)/2`;

  const args = [
    "-y", "-i", inputPath,
    "-vf", scaleFilter,
    "-c:v", "libx264", "-preset", "fast", "-profile:v", "high", "-level", "4.1",
    "-b:v", r.videoBitrate, "-maxrate", r.maxRate, "-bufsize", r.bufSize,
    "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
    "-c:a", "aac", "-b:a", r.audioBitrate, "-ac", "2",
    "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
    "-hls_segment_filename", segmentPattern,
    playlistPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    const rl = readline.createInterface({ input: proc.stderr! });

    rl.on("line", (line) => {
      const p = parseProgress(line, r.name, duration);
      if (p) onProgress(p);
    });

    proc.on("close", (code) => {
      rl.close();
      if (code === 0) {
        onProgress({ rendition: r.name, percent: 100, fps: 0, speed: 0, done: true });
        resolve();
      } else {
        reject(new Error(`ffmpeg ${r.name} exited ${code}`));
      }
    });
    proc.on("error", reject);
  });
}

export async function transcodeAll(
  jobId: string,
  inputPath: string,
  outputDir: string,
  renditions: Rendition[],
  duration: number,
  broker: EventBroker
): Promise<void> {
  const publish = (p: Progress) => {
    broker.publish(jobId, {
      event: "progress",
      job_id: jobId,
      rendition: p.rendition,
      percent: p.percent,
      fps: p.fps,
      speed: p.speed,
      done: p.done,
    });
  };

  await Promise.all(
    renditions.map((r) => transcodeOne(inputPath, outputDir, r, duration, publish))
  );

  await writeMasterPlaylist(outputDir, renditions);
}

export { pickRenditions } from "./ladder.js";
