-- Add admin review fields to Withdrawal
ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "adminNote"  TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

-- Index for faster admin queries
CREATE INDEX IF NOT EXISTS "Withdrawal_requestedAt_idx" ON "Withdrawal"("requestedAt");
