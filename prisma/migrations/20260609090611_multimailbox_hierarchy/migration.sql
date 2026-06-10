-- AlterTable
ALTER TABLE "email_updates" ADD COLUMN     "mailbox_id" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "mailbox_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "manager_id" TEXT;

-- CreateTable
CREATE TABLE "mailboxes" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "address" TEXT,
    "inbound" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imap_host" TEXT,
    "imap_port" INTEGER,
    "imap_secure" BOOLEAN NOT NULL DEFAULT true,
    "imap_user" TEXT,
    "allow_self_signed" BOOLEAN NOT NULL DEFAULT false,
    "processed_folder" TEXT,
    "failed_folder" TEXT,
    "move_processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "can_view_all" BOOLEAN NOT NULL DEFAULT false,
    "can_review" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mailboxes_key_key" ON "mailboxes"("key");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_access_user_id_mailbox_id_key" ON "mailbox_access"("user_id", "mailbox_id");

-- CreateIndex
CREATE INDEX "email_updates_mailbox_id_idx" ON "email_updates"("mailbox_id");

-- CreateIndex
CREATE INDEX "tasks_mailbox_id_idx" ON "tasks"("mailbox_id");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_updates" ADD CONSTRAINT "email_updates_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_access" ADD CONSTRAINT "mailbox_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_access" ADD CONSTRAINT "mailbox_access_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
