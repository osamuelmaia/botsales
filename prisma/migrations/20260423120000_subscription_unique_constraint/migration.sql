-- CreateIndex: unique constraint on Subscription to prevent duplicate subscriptions
-- for the same (bot, lead, product) triple created by concurrent webhook calls.
CREATE UNIQUE INDEX "Subscription_botId_leadId_productId_key" ON "Subscription"("botId", "leadId", "productId");
