#!/usr/bin/env bash
# Multi-Agent Testing Script
# Run this script to validate the multi-agent setup locally

set -e

echo "🧪 Multi-Agent Container Testing Script"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose installed${NC}"

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found. Please create one first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ .env file found${NC}"
echo ""

# Build multi-agent container
echo "🔨 Building multi-agent container..."
docker-compose build multi-agent
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Start multi-agent server
echo "🚀 Starting multi-agent server..."
docker-compose up -d multi-agent
echo -e "${GREEN}✓ Server started${NC}"
echo ""

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server is ready${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Server failed to start within 30 seconds${NC}"
    echo "Logs:"
    docker-compose logs multi-agent
    exit 1
fi
echo ""

# Test health endpoint
echo "🏥 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi
echo ""

# Test each agent endpoint
echo "🤖 Testing agent endpoints..."

AGENTS=("program-builder" "program-runner" "coach-library" "persona-chat" "crm" "licensing" "payment")

for AGENT in "${AGENTS[@]}"; do
    echo -n "Testing /$AGENT/health... "
    AGENT_HEALTH=$(curl -s http://localhost:3000/$AGENT/health)
    if echo "$AGENT_HEALTH" | grep -q '"status":"ok"'; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ Endpoint may not exist or returned unexpected response${NC}"
        echo "Response: $AGENT_HEALTH"
    fi
done
echo ""

# Test agent context endpoints (requires auth token)
echo "🔐 Testing authenticated endpoints..."
if [ -n "$SKILLZ_AGENT_AUTH_TOKEN" ]; then
    echo "Testing /program-builder/context with auth..."
    CONTEXT_RESPONSE=$(curl -s -X POST http://localhost:3000/program-builder/context \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $SKILLZ_AGENT_AUTH_TOKEN" \
        -d '{"userId":"test-user","config":{}}')
    
    if echo "$CONTEXT_RESPONSE" | grep -q 'capabilities'; then
        echo -e "${GREEN}✓ Context endpoint responded correctly${NC}"
    else
        echo -e "${YELLOW}⚠ Context endpoint returned unexpected response${NC}"
        echo "Response: $CONTEXT_RESPONSE"
    fi
else
    echo -e "${YELLOW}⚠ SKILLZ_AGENT_AUTH_TOKEN not set, skipping authenticated tests${NC}"
fi
echo ""

# Show logs
echo "📄 Recent logs:"
docker-compose logs --tail=20 multi-agent
echo ""

# Summary
echo "✅ Testing complete!"
echo ""
echo "📊 Summary:"
echo "  - Multi-agent server is running on http://localhost:3000"
echo "  - Health endpoint: http://localhost:3000/health"
echo "  - All agents are accessible at /<agent-name>/*"
echo ""
echo "📝 Next steps:"
echo "  1. Test individual agent functionality"
echo "  2. Test with your shell/frontend application"
echo "  3. Monitor resource usage: docker stats"
echo "  4. View logs: docker-compose logs -f multi-agent"
echo ""
echo "🛑 To stop the server: docker-compose down"
