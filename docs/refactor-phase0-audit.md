# Phase 0 Audit (Coverage + Test Matrix)

Date: 2026-01-29

## Coverage (test:ci)

Package | Statements | Branches | Functions | Lines | 95% threshold
- | - | - | - | - | -
ingest-worker | 100% | 100% | 100% | 100% | PASS
graph-worker | 100% | 100% | 100% | 100% | PASS
web-app | 100% | 100% | 100% | 100% | PASS

Notes:
- `pnpm --filter @drudge/ingest-worker test:ci` PASS on 2026-01-29 (100% all, API snapshots added).
- `pnpm --filter @drudge/graph-worker test:ci` PASS on 2026-01-29 (100% all, API snapshots added).
- `pnpm --filter web test:ci` PASS on 2026-01-29 (100% all).

## Test Matrix Cross-check

### ingest-worker
- IW-FS-001..010 FileStorage: ✅ `packages/ingest-worker/tests/storage/FileStorage.test.ts`
- IW-FU-001..003 FutuLiveService: ✅ `packages/ingest-worker/tests/services/FutuLiveService.test.ts`
- IW-AW-001..002 AwtmtLiveService: ✅ `packages/ingest-worker/tests/services/AwtmtLiveService.test.ts`
- IW-NOT-001 NotificationService: ✅ `packages/ingest-worker/tests/services/NotificationService.test.ts`
- IW-API-001..005 news list/fetch/count/clean/time-range: ✅ `packages/ingest-worker/tests/apis/news/*.test.ts`
- IW-API-006 system/status: ✅ `packages/ingest-worker/tests/apis/system/status.test.ts`
- IW-API-007..008 scheduler: ✅ `packages/ingest-worker/tests/apis/system/scheduler.test.ts`
- IW-API-009 healthCheck: ✅ `packages/ingest-worker/tests/apis/system/status.test.ts`
- IW-TU-001 time.parseTime: ✅ `packages/ingest-worker/tests/utils/time.test.ts`
- IW-ERR-001 error.buildErrorDetails: ✅ `packages/ingest-worker/tests/utils/error.test.ts`
- API contract snapshots: ✅ `packages/ingest-worker/tests/apis/**/__snapshots__/*.snap`

### graph-worker
Covered:
- GW-NP-001..004 NewsProcessor: ✅ `packages/graph-worker/tests/services/NewsProcessor.test.ts`
- GW-FS-001..004 FileScanner: ✅ `packages/graph-worker/tests/services/FileScanner.test.ts`
- GW-FNP-001..002 FailedNewsProcessor: ✅ `packages/graph-worker/tests/services/FailedNewsProcessor.test.ts`
- GW-RS-001 RelationshipService.createRelationship: ✅ `packages/graph-worker/tests/services/RelationshipService.test.ts`
- GW-RS-002 RelationshipService.createInferredRelationships: ✅ `packages/graph-worker/tests/services/RelationshipService.test.ts`
- GW-AI-001 AiService: ✅ `packages/graph-worker/tests/services/AiService.test.ts`
- GW-NEO-001..002 Neo4jService: ✅ `packages/graph-worker/tests/services/Neo4jService.test.ts`
- GW-TU-001 timeUtils.parseTime: ✅ `packages/graph-worker/tests/utils/timeUtils.test.ts`
- GW-API-001..009 news/process + graph/query: ✅ `packages/graph-worker/tests/apis/*.test.ts`
- GW-API-010 apis/system/status.getSystemStatus: ✅ `packages/graph-worker/tests/apis/system/status.test.ts`
- GW-EE-001 EntityExtractionService.parseExtractionResult: ✅ `packages/graph-worker/tests/services/EntityExtractionService.test.ts`
- GW-ES-001 EntityService.createNews: ✅ `packages/graph-worker/tests/services/EntityService.test.ts`
- GW-KG-001..002 KnowledgeGraphService.processNews/batchProcessNews: ✅ `packages/graph-worker/tests/services/KnowledgeGraphService.test.ts`
- API contract snapshots: ✅ `packages/graph-worker/tests/apis/**/__snapshots__/*.snap`

Missing:
- (Phase 0 list) None remaining; all listed cases covered and core modules are 100%.

### web-app
Covered:
- WA-API-001 news GET: ✅ `packages/web-app/tests/apis/news.test.ts`
- WA-API-002 news/search GET: ✅ `packages/web-app/tests/apis/news-search.test.ts`
- WA-API-003 graph/stats GET: ✅ `packages/web-app/tests/apis/graph-stats.test.ts`
- WA-API-004 graph/hot-rank GET: ✅ `packages/web-app/tests/apis/graph-hot-rank.test.ts`
- WA-API-005 graph/data GET: ✅ `packages/web-app/tests/apis/graph-data.test.ts`
- WA-API-006 graph/organizations GET: ✅ `packages/web-app/tests/apis/graph-organizations.test.ts`
- WA-API-007..008 scan POST/GET: ✅ `packages/web-app/tests/apis/scan.test.ts`
- WA-API-009 scheduler POST: ✅ `packages/web-app/tests/apis/scheduler.test.ts`
- WA-API-010 summary GET: ✅ `packages/web-app/tests/apis/summary.test.ts`
- WA-API-011 tingzi POST: ✅ `packages/web-app/tests/apis/tingzi.test.ts`
- WA-SUM-001..002 summary grouping/flow: ✅ `packages/web-app/tests/services/summary.test.ts`
- WA-NOT-001 notification formatting: ✅ `packages/web-app/tests/services/notification.test.ts`
- WA-ROB-001 robot.processTingziMessage: ✅ `packages/web-app/tests/services/robot.test.ts`
- WA-NQ-001..003 neo4j/news + analytics query tests: ✅ `packages/web-app/tests/neo4j/news.test.ts`, `packages/web-app/tests/neo4j/analytics.test.ts`
- WA-TZ-001..002 TimeZoneUtils/formatTimeFields: ✅ `packages/web-app/tests/utils/timezone.test.ts`
- WA-AH-001..003 api-helpers parse/validate/build: ✅ `packages/web-app/tests/utils/api-helpers.test.ts`

Missing:
- (Phase 0 list) None remaining; coverage gaps are in non-listed modules.

## Next Gap-Closing Targets (Phase 0)
- None. All Phase 0 coverage targets and listed cases are covered as of 2026-01-29.
