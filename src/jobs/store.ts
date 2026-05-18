import fs from "node:fs/promises";
import path from "node:path";
import type { Job, VMAFReport, VMAFScore } from "../types.js";

const META_FILE = "job.json";

export class JobStore {
  private jobs = new Map<string, Job>();

  constructor(
    private uploadsDir: string,
    private outputDir: string
  ) {}

  get outputDirPath(): string {
    return this.outputDir;
  }

  save(job: Job): void {
    this.jobs.set(job.id, job);
    void this.persist(job);
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  list(): Job[] {
    return [...this.jobs.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  updateStatus(id: string, status: string): void {
    const j = this.jobs.get(id);
    if (!j) return;
    j.status = status;
    void this.persist(j);
  }

  saveVmaf(id: string, scores: VMAFScore[]): void {
    const j = this.jobs.get(id);
    if (!j) return;
    j.vmaf_scores = scores;
    void this.persist(j);
  }

  async delete(id: string): Promise<void> {
    const j = this.jobs.get(id);
    if (!j) throw new Error("job not found");

    if (j.output_dir) {
      await fs.rm(j.output_dir, { recursive: true, force: true });
    }
    if (j.input_path) {
      await fs.rm(j.input_path, { force: true }).catch(() => {});
    }
    this.jobs.delete(id);
  }

  async loadFromDisk(): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.outputDir);
    } catch {
      return;
    }

    let loaded = 0;
    for (const name of entries) {
      if (!name.startsWith("job_")) continue;
      const jobDir = path.join(this.outputDir, name);
      const stat = await fs.stat(jobDir).catch(() => null);
      if (!stat?.isDirectory()) continue;

      try {
        const job = await this.loadFromDir(jobDir, name);
        this.jobs.set(job.id, job);
        loaded++;
      } catch (err) {
        console.warn(`⚠️  skip ${name}:`, err);
      }
    }
    if (loaded > 0) console.log(`📂 Restored ${loaded} job(s) from disk`);
  }

  private async persist(job: Job): Promise<void> {
    if (!job.output_dir) return;
    await fs.writeFile(
      path.join(job.output_dir, META_FILE),
      JSON.stringify(job, null, 2),
      "utf8"
    );
  }

  private async loadFromDir(jobDir: string, jobId: string): Promise<Job> {
    const metaPath = path.join(jobDir, META_FILE);
    try {
      const raw = await fs.readFile(metaPath, "utf8");
      const j = JSON.parse(raw) as Job;
      if (!j.id) j.id = jobId;
      if (!j.output_dir) j.output_dir = jobDir;
      return j;
    } catch {
      const job = await this.reconstruct(jobDir, jobId);
      await this.persist(job);
      return job;
    }
  }

  private async reconstruct(jobDir: string, jobId: string): Promise<Job> {
    const stat = await fs.stat(jobDir);
    const renditions = await this.scanRenditions(jobDir);

    let status = "processing";
    try {
      await fs.access(path.join(jobDir, "master.m3u8"));
      status = "done";
    } catch {
      if (renditions.length > 0) status = "failed";
    }

    const { inputPath, filename } = await this.matchUpload(jobId);

    return {
      id: jobId,
      input_path: inputPath,
      output_dir: jobDir,
      filename: filename || jobId,
      status,
      renditions,
      vmaf_scores: await this.loadVmafFromDisk(jobDir, renditions),
      created_at: stat.mtime.toISOString(),
    };
  }

  private async scanRenditions(jobDir: string): Promise<string[]> {
    const entries = await fs.readdir(jobDir, { withFileTypes: true });
    const names: string[] = [];
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      try {
        await fs.access(path.join(jobDir, ent.name, "stream.m3u8"));
        names.push(ent.name);
      } catch {
        /* skip */
      }
    }
    return names.sort((a, b) => parseHeight(b) - parseHeight(a));
  }

  private async loadVmafFromDisk(jobDir: string, renditions: string[]): Promise<VMAFScore[]> {
    const scores: VMAFScore[] = [];
    for (const name of renditions) {
      try {
        const raw = await fs.readFile(path.join(jobDir, name, "vmaf.json"), "utf8");
        const report = JSON.parse(raw) as VMAFReport;
        const v = report.pooled_metrics.vmaf;
        scores.push({ rendition: name, mean: v.mean, min: v.min, max: v.max });
      } catch {
        /* skip */
      }
    }
    return scores;
  }

  private async matchUpload(jobId: string): Promise<{ inputPath: string; filename: string }> {
    const tsStr = jobId.replace(/^job_/, "");
    const jobTs = BigInt(tsStr);
    let entries: string[];
    try {
      entries = await fs.readdir(this.uploadsDir);
    } catch {
      return { inputPath: "", filename: "" };
    }

    let bestPath = "";
    let bestName = "";
    let bestDiff = BigInt(Number.MAX_SAFE_INTEGER);

    for (const name of entries) {
      const parts = name.split("_");
      if (parts.length < 2) continue;
      const uploadTs = BigInt(parts[0]);
      const diff = uploadTs > jobTs ? uploadTs - jobTs : jobTs - uploadTs;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPath = path.join(this.uploadsDir, name);
        bestName = parts.slice(1).join("_");
      }
    }

    const maxSkew = BigInt(10_000_000_000); // 10s in nanoseconds
    if (bestDiff > maxSkew) return { inputPath: "", filename: "" };
    return { inputPath: bestPath, filename: bestName };
  }
}

function parseHeight(name: string): number {
  return parseInt(name.replace(/p$/, ""), 10) || 0;
}
