import fs from "node:fs/promises";
import { loadConfig } from "./config.js";
import { createApp } from "./api/app.js";
import { EventBroker } from "./events/broker.js";
import { JobStore } from "./jobs/store.js";
import { PipelineRunner } from "./pipeline/runner.js";

async function main(): Promise<void> {
  const config = loadConfig();

  await fs.mkdir(config.uploadsDir, { recursive: true });
  await fs.mkdir(config.outputDir, { recursive: true });

  const store = new JobStore(config.uploadsDir, config.outputDir);
  await store.loadFromDisk();

  const broker = new EventBroker();
  const runner = new PipelineRunner(store, broker);

  const app = createApp({ config, store, broker, runner });

  app.listen(config.port, () => {
    console.log(`🎬 Server running at http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
