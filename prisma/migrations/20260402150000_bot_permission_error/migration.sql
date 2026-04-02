ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "channelPermissionError"   TEXT;
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "channelPermissionErrorAt" TIMESTAMP(3);

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

ALTER TABLE "PendingKick" DROP CONSTRAINT IF EXISTS "PendingKick_botId_fkey";
ALTER TABLE "PendingKick" ADD CONSTRAINT "PendingKick_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
