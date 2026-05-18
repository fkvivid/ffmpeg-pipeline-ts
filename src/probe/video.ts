import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FFprobeOutput, VideoInfo } from "../types.js";

const execFileAsync = promisify(execFile);

function parseFrameRate(s: string): number {
  const [num, den] = s.split("/").map(Number);
  if (!den) return 0;
  return num / den;
}

export async function probeVideo(filePath: string): Promise<VideoInfo> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    filePath,
  ]);

  const raw = JSON.parse(stdout) as FFprobeOutput;
  const info: VideoInfo = {
    filename: "",
    size: 0,
    width: 0,
    height: 0,
    duration: 0,
    fps: 0,
    codec: "",
  };

  if (raw.format?.duration) {
    info.duration = parseFloat(raw.format.duration);
  }

  for (const s of raw.streams ?? []) {
    if (s.codec_type !== "video") continue;
    info.width = s.width;
    info.height = s.height;
    info.codec = s.codec_name;
    info.fps = parseFrameRate(s.r_frame_rate);
    break;
  }

  if (info.width === 0) {
    throw new Error("no video stream found");
  }
  return info;
}
