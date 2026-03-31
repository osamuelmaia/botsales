-- Rename old enum
ALTER TYPE "FlowNodeType" RENAME TO "FlowNodeType_old";

-- Create new enum with all values
CREATE TYPE "FlowNodeType" AS ENUM ('TRIGGER_START', 'TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'TYPING', 'BUTTON', 'DELAY', 'SMART_DELAY', 'PAYMENT');

-- Update column to new enum, converting MESSAGE -> TEXT
ALTER TABLE "FlowNode" ALTER COLUMN "type" TYPE "FlowNodeType" USING (
  CASE "type"::text
    WHEN 'MESSAGE' THEN 'TEXT'
    ELSE "type"::text
  END
)::"FlowNodeType";

-- Drop old enum
DROP TYPE "FlowNodeType_old";
