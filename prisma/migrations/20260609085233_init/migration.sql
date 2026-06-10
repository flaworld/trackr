-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "task_code" TEXT NOT NULL,
    "assigned_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "task_name" TEXT NOT NULL,
    "owner_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "due_date" TIMESTAMP(3),
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latest_notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_updates" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "mailbox_uid" TEXT,
    "from_email" TEXT,
    "from_name" TEXT,
    "subject" TEXT,
    "body_text" TEXT,
    "body_html" TEXT,
    "received_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "processing_status" TEXT NOT NULL DEFAULT 'received',
    "matched_task_id" TEXT,
    "match_confidence" INTEGER,
    "extracted_status" TEXT,
    "extracted_due_date" TIMESTAMP(3),
    "extracted_summary" TEXT,
    "raw_headers" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_update_suggestions" (
    "id" TEXT NOT NULL,
    "email_update_id" TEXT NOT NULL,
    "task_id" TEXT,
    "suggested_status" TEXT,
    "suggested_due_date" TIMESTAMP(3),
    "suggested_notes" TEXT,
    "confidence_score" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "review_status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_update_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_history" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "changed_by" TEXT,
    "source_type" TEXT NOT NULL,
    "source_email_update_id" TEXT,
    "previous_status" TEXT,
    "new_status" TEXT,
    "previous_due_date" TIMESTAMP(3),
    "new_due_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "email_update_id" TEXT NOT NULL,
    "filename" TEXT,
    "content_type" TEXT,
    "file_size" INTEGER,
    "storage_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_task_code_key" ON "tasks"("task_code");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_owner_id_idx" ON "tasks"("owner_id");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "email_updates_message_id_key" ON "email_updates"("message_id");

-- CreateIndex
CREATE INDEX "email_updates_processing_status_idx" ON "email_updates"("processing_status");

-- CreateIndex
CREATE INDEX "task_update_suggestions_review_status_idx" ON "task_update_suggestions"("review_status");

-- CreateIndex
CREATE INDEX "task_history_task_id_idx" ON "task_history"("task_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_updates" ADD CONSTRAINT "email_updates_matched_task_id_fkey" FOREIGN KEY ("matched_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_update_suggestions" ADD CONSTRAINT "task_update_suggestions_email_update_id_fkey" FOREIGN KEY ("email_update_id") REFERENCES "email_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_update_suggestions" ADD CONSTRAINT "task_update_suggestions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_update_suggestions" ADD CONSTRAINT "task_update_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_source_email_update_id_fkey" FOREIGN KEY ("source_email_update_id") REFERENCES "email_updates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_update_id_fkey" FOREIGN KEY ("email_update_id") REFERENCES "email_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
