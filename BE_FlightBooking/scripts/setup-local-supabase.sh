#!/bin/bash
# ============================================================
# Setup Supabase Local Development Environment
# Yêu cầu: Docker Desktop đang chạy, npm đã cài
# ============================================================

set -e

echo "=== Setup Supabase Local ==="
echo ""

# Step 1: Check Docker
echo "[1/7] Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker not found. Please install Docker Desktop first."
    exit 1
fi
echo "Docker OK."

# Step 2: Install dependencies
echo "[2/7] Installing npm dependencies..."
npm install

# Step 3: Check Supabase CLI via npx
echo "[3/7] Checking Supabase CLI via npx..."
npx supabase --version || { echo "ERROR: npx supabase failed."; exit 1; }

# Step 4: Init Supabase (skip if already initialized)
echo "[4/7] Initializing Supabase..."
if [ ! -d "supabase" ]; then
    npx supabase init
else
    echo "Already initialized, skipping."
fi

# Step 5: Start Supabase local
echo "[5/7] Starting Supabase local (Docker containers)..."
echo "First time will download ~2-3GB of Docker images. Please wait..."
npx supabase start

# Step 6: Run SQL migrations
echo "[6/7] Running SQL migrations..."

echo "Running schema..."
npx supabase db execute -f src/migrations/supabase_schema.sql || echo "WARNING: Schema may have already been applied."

echo "Running RPC transactions..."
npx supabase db execute -f src/migrations/supabase_rpc_transactions.sql || echo "WARNING: RPC transactions may have already been applied."

echo "Running RPC reports..."
npx supabase db execute -f src/migrations/supabase_rpc_reports.sql || echo "WARNING: RPC reports may have already been applied."

# Step 7: Create .env from local credentials
echo "[7/7] Creating .env with local Supabase credentials..."

SUPA_URL=$(npx supabase status -o env | grep API_URL | cut -d= -f2)
SUPA_ANON=$(npx supabase status -o env | grep ANON_KEY | cut -d= -f2)
SUPA_SECRET=$(npx supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2)

cat > .env << EOF
# Supabase Configuration (Local)
SUPABASE_URL=${SUPA_URL}
SUPABASE_PUBLISHABLE_KEY=${SUPA_ANON}
SUPABASE_SECRET_KEY=${SUPA_SECRET}

# Application Configuration
JWT_SECRET=local-dev-jwt-secret-key
PORT=4000
CORS_ORIGIN=http://localhost:3000
DEBUG=true
EOF

echo ".env created with local Supabase credentials."

# Seed data
echo ""
echo "Running seed data..."
npm run seed || echo "WARNING: Seed may have failed. Check output above."

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Supabase Studio: http://127.0.0.1:54323"
echo "API URL: ${SUPA_URL}"
echo ""
echo "Run the app: npm run dev"
