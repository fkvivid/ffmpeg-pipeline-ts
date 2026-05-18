import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { EventBroker } from "../events/broker.js";
import type { Rendition, VMAFReport, VMAFScore } from "../types.js";

const execFileAsync = promisify(execFile);

async function runOne(referencePath: string, outputDir: string, renditionName: string): Promise<VMAFScore> {
  const renditionPlaylist = path.join(outputDir, renditionName, "stream.m3u8");
  const logPath = path.join(outputDir, renditionName, "vmaf.json");

  const vmafFilter =
    `[0:v]format=yuv420p10le,setpts=PTS-STARTPTS,settb=AVTB[dist];` +
    `[1:v]format=yuv420p10le,setpts=PTS-STARTPTS,settb=AVTB[ref];` +
    `[dist][ref]libvmaf=shortest=true:ts_sync_mode=nearest:n_threads=4:log_path=${logPath}:log_fmt=json`;

  try {
    await execFileAsync("ffmpeg", [
      "-i", renditionPlaylist,
      "-i", referencePath,
      "-filter_complex", vmafFilter,
      "-an", "-sn", "-dn",
      "-f", "null",
      "-",
    ]);
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    throw new Error(`ffmpeg vmaf ${renditionName}: ${e.stderr ?? e.message}`);
  }

  const raw = await fs.readFile(logPath, "utf8");
  const report = JSON.parse(raw) as VMAFReport;
  const v = report.pooled_metrics.vmaf;

  return { rendition: renditionName, mean: v.mean, min: v.min, max: v.max };
}

export async function runVmafAll(
  jobId: string,
  referencePath: string,
  outputDir: string,
  renditions: Rendition[],
  broker: EventBroker
): Promise<VMAFScore[]> {
  const results = await Promise.all(
    renditions.map(async (r) => {
      broker.publish(jobId, { event: "vmaf_start", rendition: r.name });
      try {
        const score = await runOne(referencePath, outputDir, r.name);
        broker.publish(jobId, {
          event: "vmaf_score",
          rendition: r.name,
          mean: score.mean,
          min: score.min,
          max: score.max,
        });
        console.log(`📊 [${r.name}] VMAF mean: ${score.mean.toFixed(2)}`);
        return score;
      } catch (err) {
        console.warn(`⚠️  [${r.name}] VMAF failed:`, err);
        return null;
      }
    })
  );

  return results.filter((s): s is VMAFScore => s !== null);
}
