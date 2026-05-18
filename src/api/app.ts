import express, { type Express, type Request, type Response } from "express";
import fs from "node:fs/promises";
import multer from "multer";
import path from "node:path";
import type { Config } from "../config.js";
import { EventBroker } from "../events/broker.js";
import { JobStore } from "../jobs/store.js";
import { PipelineRunner } from "../pipeline/runner.js";
import { probeVideo } from "../probe/video.js";
import { pickRenditions } from "../transcode/ladder.js";
import type { Job } from "../types.js";

export interface AppContext {
  config: Config;
  store: JobStore;
  broker: EventBroker;
  runner: PipelineRunner;
}

export function createApp(ctx: AppContext): Express {
  const { config, store, broker, runner } = ctx;
  const app = express();

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, config.uploadsDir),
      filename: (_req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 * 1024 },
  });

  // —— API ——
  app.get("/api/jobs", (_req, res) => {
    res.json(store.list());
  });

  app.get("/api/jobs/:id", (req, res) => {
    const job = store.get(req.params.id);
    if (!job) {
      res.status(404).send("job not found");
      return;
    }
    res.json(job);
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      await store.delete(req.params.id);
      res.status(204).end();
    } catch {
      res.status(404).send("job not found");
    }
  });

  app.post("/api/upload", upload.single("video"), async (req, res) => {
    if (!req.file) {
      res.status(400).send("missing 'video' field");
      return;
    }

    const savePath = req.file.path;
    console.log(`✅ Saved: ${savePath}`);

    try {
      const info = await probeVideo(savePath);
      info.filename = req.file.filename;
      info.size = req.file.size;

      const renditions = pickRenditions(info.height);
      const renditionNames = renditions.map((r) => r.name);
      console.log(`📊 Probed: ${info.width}x${info.height}, ${info.duration.toFixed(1)}s, encoding: ${renditionNames}`);

      const jobId = `job_${Date.now()}`;
      const jobDir = path.join(config.outputDir, jobId);
      await fs.mkdir(jobDir, { recursive: true });

      const job: Job = {
        id: jobId,
        input_path: savePath,
        output_dir: jobDir,
        filename: req.file.originalname,
        status: "processing",
        renditions: renditionNames,
        created_at: new Date().toISOString(),
      };
      store.save(job);

      runner.run(jobId, savePath, jobDir, renditions, info.duration);

      res.json({
        job_id: jobId,
        info,
        renditions: renditionNames,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("could not process video");
    }
  });

  app.get("/api/events/:jobId", (req, res) => {
    const jobId = req.params.jobId;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    res.write('data: {"event":"connected"}\n\n');

    const unsubscribe = broker.subscribe(jobId, (data) => {
      res.write(`data: ${data}\n\n`);
    });

    req.on("close", () => {
      unsubscribe();
      res.end();
    });
  });

  // —— HLS output ——
  app.use("/stream", express.static(store.outputDirPath));

  // —— Web UI ——
  app.use("/static", express.static(path.join(config.publicDir, "static")));
  app.get("/player.html", (_req, res) => {
    res.sendFile(path.join(config.publicDir, "player.html"));
  });
  app.get(["/", "/index.html"], (_req, res) => {
    res.sendFile(path.join(config.publicDir, "index.html"));
  });

  return app;
}
