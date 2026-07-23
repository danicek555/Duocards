CREATE TABLE "admin_audit_log" (
    "id" SERIAL NOT NULL,
    "adminUserId" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "detail" VARCHAR(256),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_audit_log_adminUserId_createdAt_idx" ON "admin_audit_log"("adminUserId", "createdAt");
