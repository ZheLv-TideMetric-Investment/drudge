# Drudge I/O Contract

## News File Contract (ingest -> graph)

### File location
- Directory: `data/news/`
- File name: `<source>_<YYYY_MM_DD_HH_mm_ss_SSS>.json`
- Each file contains one JSON array of `NewsItem` objects.

### NewsItem (ingest output)
Required fields:
- `id`: string, unique news id
- `title`: string
- `content`: string
- `source`: string (example: `futu_live`, `awtmt_live`)
- `time`: number (milliseconds since epoch)

Optional fields:
- `url`: string
- `author`, `category`, `summary`, or extra metadata fields

### Time handling
- Ingest services normalize incoming timestamps to **milliseconds**.
- Graph worker converts `time` / `timestamp` / `publishTime` to `timestamp` (UTC ISO string).

### Processed markers
- Processed marker directory: `data/news/.processed/`
- Marker file name: `<newsFile>.processed`
- Marker content (JSON): includes `fileName`, `processedAt`, `fileSize`, `processedBy`.

### Failed files
- Failed news directory: `data/news/failed/`
- Failed file name: `failed_<newsId>_<timestamp>.json`
- Failed file content: includes `newsItem`, `error`, `metadata`.

### Example
```json
[
  {
    "id": "19046732",
    "title": "Example title",
    "content": "Example content",
    "source": "futu_live",
    "time": 1704067200000,
    "url": "https://example.com"
  }
]
```

## Run Paths (Local/PM2/Docker)
- Local dev (参考 README 环境变量配置):
  - `pnpm --filter @drudge/ingest-worker dev`
  - `pnpm --filter @drudge/graph-worker dev`
  - `pnpm --filter web dev`
- Build + start:
  - `pnpm -r run build`
  - `pnpm --filter @drudge/ingest-worker start`
  - `pnpm --filter @drudge/graph-worker start`
  - `pnpm --filter web start`
- PM2:
  - 根级: `pnpm pm2:start` / `pnpm pm2:stop`
  - 单包: `pnpm --filter @drudge/ingest-worker pm2:start`（graph/web 同理）
- Docker:
  - `docker-compose up -d`

## Minimal Manual Validation Chain
1) 启动 Neo4j（见 README 的 Docker 示例）。
2) 启动 ingest-worker + graph-worker + web-app（见上方 Run Paths）。
3) 触发 ingest 抓取并生成文件:
   - `POST http://localhost:39110/trigger/fetch-news`
   - 预期: `data/news/<source>_<timestamp>.json` 出现
4) graph-worker 调度器自动扫描并处理文件:
   - 预期: `data/news/.processed/*.processed` 生成
   - 验证: `GET http://localhost:39111/api/stats` 返回图谱统计
5) web-app 读取并展示:
   - `GET http://localhost:39112/api/graph/stats` 或访问 `/stats` 页面
