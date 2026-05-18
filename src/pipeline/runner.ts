import type { EventBroker } from "../events/broker.js";
import type { JobStore } from "../jobs/store.js";
import type { Rendition } from "../types.js";
import { transcodeAll } from "../transcode/index.js";
import { runVmafAll } from "../vmaf/index.js";

export class PipelineRunner {
  constructor(
    private store: JobStore,
    private broker: EventBroker
  ) {}

  run(
    jobId: string,
    inputPath: string,
    outputDir: string,
    renditions: Rendition[],
    duration: number
  ): void {
    void this.execute(jobId, inputPath, outputDir, renditions, duration);
  }

  private async execute(
    jobId: string,
    inputPath: string,
    outputDir: string,
    renditions: Rendition[],
    duration: number
  ): Promise<void> {
    const start = Date.now();
    console.log(`🎬 [${jobId}] Starting parallel transcode of ${renditions.length} renditions...`);

    try {
      await transcodeAll(jobId, inputPath, outputDir, renditions, duration, this.broker);
    } catch (err) {
      console.error(`❌ [${jobId}] Failed:`, err);
      this.store.updateStatus(jobId, "failed");
      this.broker.publish(jobId, {
        event: "error",
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    console.log(`✅ [${jobId}] Transcode done in ${Math.round((Date.now() - start) / 1000)}s`);

    this.store.updateStatus(jobId, "scoring");
    this.broker.publish(jobId, { event: "status", status: "scoring" });

    const vmafStart = Date.now();
    const scores = await runVmafAll(jobId, inputPath, outputDir, renditions, this.broker);
    this.store.saveVmaf(jobId, scores);
    console.log(`✅ [${jobId}] VMAF done in ${Math.round((Date.now() - vmafStart) / 1000)}s`);
    console.log(`🎉 [${jobId}] All done in ${Math.round((Date.now() - start) / 1000)}s`);

    this.store.updateStatus(jobId, "done");
    this.broker.publish(jobId, { event: "done" });
  }
}
