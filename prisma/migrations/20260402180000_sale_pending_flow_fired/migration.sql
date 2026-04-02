-- AlterTable: add pendingFlowFiredAt to Sale
ALTER TABLE "Sale" ADD COLUMN "pendingFlowFiredAt" TIMESTAMP(3);
