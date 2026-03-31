-- AlterTable: add Telegram context fields to Sale
ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "botId" TEXT,
  ADD COLUMN IF NOT EXISTS "tgChatId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentNodeId" TEXT;
