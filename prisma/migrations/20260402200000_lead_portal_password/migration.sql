-- Add customer portal password hash to Lead
ALTER TABLE "Lead" ADD COLUMN "portalPasswordHash" TEXT;
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
