#!/usr/bin/env bash
set -euo pipefail

# ========= 参数，可按需修改 =========
CONTAINER_NAME="drudge-neo4j"
IMAGE="neo4j:latest"
PASSWORD="niuniuniu"
IMPORT_DIR="$PWD/neo4j"   # 本地导入目录
NETWORK="drudge-network"
# ===================================

echo "▶️  准备卷..."
docker volume inspect neo4j_data >/dev/null 2>&1 || docker volume create neo4j_data
docker volume inspect neo4j_logs >/dev/null 2>&1 || docker volume create neo4j_logs

echo "▶️  准备网络..."
docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK"

echo "▶️  清理旧容器..."
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker stop "$CONTAINER_NAME" && docker rm "$CONTAINER_NAME"
fi

echo "▶️  启动 Neo4j..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$NETWORK" \
  -p 7474:7474 \
  -p 7687:7687 \
  -v neo4j_data:/data \
  -v neo4j_logs:/logs \
  -v "$IMPORT_DIR":/var/lib/neo4j/import \
  -e NEO4J_AUTH="neo4j/$PASSWORD" \
  -e NEO4J_PLUGINS='["apoc"]' \
  -e NEO4J_db_tx__log_rotation_retention__policy='1 files' \
  -e NEO4J_dbms_security_procedures_unrestricted='apoc.*' \
  -e NEO4J_dbms_memory_heap_initial__size=512m \
  -e NEO4J_dbms_memory_heap_max__size=1G \
  --health-cmd='cypher-shell -u neo4j -p '"$PASSWORD"' "RETURN 1"' \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=5 \
  --health-start-period=30s \
  "$IMAGE"

echo "✅  Neo4j 已启动：bolt://localhost:7687  |  http://localhost:7474"
