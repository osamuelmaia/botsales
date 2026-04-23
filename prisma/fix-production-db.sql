-- ============================================================
-- BOTSALES — Apply all pending migrations to production DB
-- Run this in the Neon Console → SQL Editor
--
-- IMPORTANT: Run the ALTER TYPE blocks FIRST (one at a time),
-- then run the rest of this file in a single execution.
-- ============================================================

-- ── Step 1: Enum updates (run EACH statement individually) ──
-- ALTER TYPE cannot run inside a transaction block in PostgreSQL.
-- Paste and run each of these ONE AT A TIME in the Neon SQL editor:

--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'TEXT';
--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'IMAGE';
--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'VIDEO';
--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'AUDIO';
--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'FILE';
--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'TYPING';
--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'BUTTON';
--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'DELAY';
--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'REMARKETING_START';
--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'KICK_MEMBER';
--   ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'GRANT_ACCESS';

-- ── Step 2: Run everything below in one shot ────────────────

-- BotMedia table
CREATE TABLE IF NOT EXISTS "BotMedia" (
    "id"           TEXT        NOT NULL,
    "userId"       TEXT        NOT NULL,
    "key"          TEXT        NOT NULL,
    "url"          TEXT        NOT NULL,
    "mimeType"     TEXT        NOT NULL,
    "sizeBytes"    INTEGER     NOT NULL,
    "originalName" TEXT        NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotMedia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BotMedia_key_key"    ON "BotMedia"("key");
CREATE INDEX        IF NOT EXISTS "BotMedia_userId_idx" ON "BotMedia"("userId");
DO $$ BEGIN
  ALTER TABLE "BotMedia" ADD CONSTRAINT "BotMedia_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- FlowNode type migration: rename MESSAGE -> TEXT
-- (only runs if MESSAGE still exists in the enum)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'FlowNodeType' AND e.enumlabel = 'MESSAGE'
  ) THEN
    UPDATE "FlowNode" SET "type" = 'TEXT'::"FlowNodeType"
    WHERE "type"::text = 'MESSAGE';
  END IF;
END $$;

-- FlowEdge: sourceHandle column
ALTER TABLE "FlowEdge" ADD COLUMN IF NOT EXISTS "sourceHandle" TEXT;

-- Sale: Telegram context columns
ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "botId"         TEXT,
  ADD COLUMN IF NOT EXISTS "tgChatId"      TEXT,
  ADD COLUMN IF NOT EXISTS "paymentNodeId" TEXT;

-- SubscriptionStatus enum
DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'REMARKETING', 'KICKED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Bot: subscription / remarketing columns
ALTER TABLE "Bot"
  ADD COLUMN IF NOT EXISTS "gracePeriodDays" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "remarketingFlow"  JSONB;

-- Subscription table
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id"               TEXT NOT NULL,
    "botId"            TEXT NOT NULL,
    "leadId"           TEXT NOT NULL,
    "productId"        TEXT NOT NULL,
    "groupTgChatId"    TEXT NOT NULL,
    "tgUserId"         TEXT NOT NULL,
    "status"           "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "gatewayChargeId"  TEXT,
    "remarketingStart" TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Subscription_botId_idx"    ON "Subscription"("botId");
CREATE INDEX IF NOT EXISTS "Subscription_leadId_idx"   ON "Subscription"("leadId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx"   ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Subscription_tgUserId_idx" ON "Subscription"("tgUserId");
DO $$ BEGIN
  ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_botId_fkey"
    FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Withdrawal: admin review columns
ALTER TABLE "Withdrawal"
  ADD COLUMN IF NOT EXISTS "adminNote"  TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Withdrawal_requestedAt_idx" ON "Withdrawal"("requestedAt");

-- Bot: channel permission error columns
ALTER TABLE "Bot"
  ADD COLUMN IF NOT EXISTS "channelPermissionError"   TEXT,
  ADD COLUMN IF NOT EXISTS "channelPermissionErrorAt" TIMESTAMP(3);

-- PendingKick table
CREATE TABLE IF NOT EXISTS "PendingKick" (
  "id"             TEXT NOT NULL,
  "botId"          TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "tgUserId"       TEXT NOT NULL,
  "groupChatId"    TEXT NOT NULL,
  "failedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "errorMessage"   TEXT,
  CONSTRAINT "PendingKick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PendingKick_botId_idx" ON "PendingKick"("botId");
DO $$ BEGIN
  ALTER TABLE "PendingKick" ADD CONSTRAINT "PendingKick_botId_fkey"
    FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Sale: pendingFlowFiredAt column
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "pendingFlowFiredAt" TIMESTAMP(3);

-- Lead: customer portal password
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "portalPasswordHash" TEXT;
CREATE INDEX IF NOT EXISTS "Lead_email_idx" ON "Lead"("email");

-- Product: short checkout ID (7-8 char alphanumeric, e.g. /checkout/aB3kR9mZ)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shortId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Product_shortId_key" ON "Product"("shortId");

-- Grant admin role to samuelcoprod@gmail.com
UPDATE "User" SET role = 'ADMIN' WHERE email = 'samuelcoprod@gmail.com';

-- Done!
SELECT 'Migration complete' AS status;
