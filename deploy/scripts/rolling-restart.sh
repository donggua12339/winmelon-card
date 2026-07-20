#!/bin/bash
# M3: 3 实例滚动升级脚本
# 一次重启一个实例，等待 health 通过后再继续
# 用法：./rolling-restart.sh [instance-name-prefix]
# 默认前缀：wm-card-api-

set -e

PREFIX="${1:-wm-card-api-}"
WAIT_HEALTH_SECS=30

for i in 1 2 3; do
    CONTAINER="${PREFIX}${i}"
    echo "=== 重启 ${CONTAINER} ==="
    docker restart "${CONTAINER}"
    echo "等待 ${WAIT_HEALTH_SECS}s 让 health 通过..."
    sleep "${WAIT_HEALTH_SECS}"
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER}" 2>/dev/null || echo "unknown")
    echo "${CONTAINER} health: ${STATUS}"
    if [ "${STATUS}" != "healthy" ]; then
        echo "❌ ${CONTAINER} 未通过 health check，请人工排查"
        exit 1
    fi
    echo ""
done

echo "✅ 3 实例滚动升级完成"
