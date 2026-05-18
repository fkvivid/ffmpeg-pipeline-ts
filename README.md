# ffmpeg-pipeline (Node.js)

Node.js / TypeScript port of the Go encoding pipeline. Same features: upload → HLS ladder → VMAF → playback with ABR.

Use this version if you're more comfortable with JavaScript than Go. The Go version lives in the parent directory.

## Requirements

- **Node.js 20+**
- **FFmpeg** with `libvmaf` (`brew install ffmpeg`)

## Quick start

```bash
cd node
npm install
npm run dev
```

Open http://localhost:8000

## Scripts

| Command        | Description                    |
|----------------|--------------------------------|
| `npm run dev`  | Start with hot reload (tsx)    |
| `npm run build`| Compile TypeScript → `dist/`   |
| `npm start`    | Run compiled production build  |

## Configuration

Copy `.env.example` to `.env` or set environment variables:

| Variable       | Default           | Description        |
|----------------|-------------------|--------------------|
| `PORT`         | `8000`            | HTTP port          |
| `UPLOADS_DIR`  | `./data/uploads`  | Source uploads     |
| `OUTPUT_DIR`   | `./data/output`   | HLS + job metadata |

## Project layout

```
node/
├── public/              # Web UI (HTML, CSS, JS)
├── src/
│   ├── index.ts         # Entry point
│   ├── config.ts        # Environment config
│   ├── types.ts         # Shared TypeScript types
│   ├── api/app.ts       # Express routes
│   ├── jobs/store.ts    # Job persistence
│   ├── events/broker.ts # SSE fan-out
│   ├── probe/video.ts   # ffprobe
│   ├── transcode/       # HLS encoding
│   ├── vmaf/            # Quality scoring
│   └── pipeline/        # Job orchestration
├── data/                # Created at runtime (gitignored)
├── package.json
└── tsconfig.json
```

## API

Same as the Go server:

| Method   | Path               | Description        |
|----------|--------------------|--------------------|
| `POST`   | `/api/upload`      | Upload & encode    |
| `GET`    | `/api/jobs`        | List jobs          |
| `GET`    | `/api/jobs/:id`    | Job details        |
| `DELETE` | `/api/jobs/:id`    | Delete job         |
| `GET`    | `/api/events/:id`  | SSE progress       |
| `GET`    | `/stream/:id/...`  | HLS segments       |

## Go vs Node — mental map

| Go                    | Node.js (this port)      |
|-----------------------|--------------------------|
| `cmd/server/main.go`  | `src/index.ts`           |
| `internal/api`        | `src/api/app.ts`         |
| `internal/jobs`       | `src/jobs/store.ts`      |
| `internal/events`     | `src/events/broker.ts`   |
| `goroutine`           | `void this.execute(...)` (async, no await in caller) |
| `sync.RWMutex`        | `Map` (single-threaded JS) |
| `//go:embed web`      | `express.static('public')` |
| `errgroup`            | `Promise.all`            |
