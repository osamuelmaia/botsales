-- AlterEnum: add new FlowNodeType values
ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'REMARKETING_START';
ALTER TYPE "FlowNodeType" ADD VALUE IF NOT EXISTS 'KICK_MEMBER';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'REMARKETING', 'KICKED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable Bot
ALTER TABLE "Bot"
  ADD COLUMN IF NOT EXISTS "gracePeriodDays" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "remarketingFlow"  JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id"               TEXT        NOT NULL,
    "botId"            TEXT        NOT NULL,
    "leadId"           TEXT        NOT NULL,
    "productId"        TEXT        NOT NULL,
    "groupTgChatId"    TEXT        NOT NULL,
    "tgUserId"         TEXT        NOT NULL,
    "status"           "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "gatewayChargeId"  TEXT,
    "remarketingStart" TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Subscription_botId_idx"   ON "Subscription"("botId");
CREATE INDEX IF NOT EXISTS "Subscription_leadId_idx"  ON "Subscription"("leadId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx"  ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Subscription_tgUserId_idx" ON "Subscription"("tgUserId");

-- ForeignKeys
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
