export interface VideoInfo {
  filename: string;
  size: number;
  width: number;
  height: number;
  duration: number;
  fps: number;
  codec: string;
}

export interface Rendition {
  name: string;
  width: number;
  height: number;
  videoBitrate: string;
  audioBitrate: string;
  maxRate: string;
  bufSize: string;
}

export interface Progress {
  jobId?: string;
  rendition: string;
  percent: number;
  fps: number;
  speed: number;
  done: boolean;
}

export interface VMAFScore {
  rendition: string;
  mean: number;
  min: number;
  max: number;
}

export interface Job {
  id: string;
  input_path: string;
  output_dir: string;
  filename: string;
  status: string;
  renditions: string[];
  vmaf_scores?: VMAFScore[];
  created_at: string;
}

export interface UploadResponse {
  job_id: string;
  info: VideoInfo;
  renditions: string[];
}

export interface VMAFReport {
  pooled_metrics: {
    vmaf: { mean: number; min: number; max: number };
  };
}

export interface FFprobeOutput {
  streams: Array<{
    codec_type: string;
    codec_name: string;
    width: number;
    height: number;
    r_frame_rate: string;
  }>;
  format: { duration: string };
}
