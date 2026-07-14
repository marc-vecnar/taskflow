-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- DropIndex
DROP INDEX "tasks_userId_isDeleted_idx";

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'MEDIUM';

-- CreateIndex
CREATE INDEX "tasks_userId_isDeleted_priority_idx" ON "tasks"("userId", "isDeleted", "priority");
