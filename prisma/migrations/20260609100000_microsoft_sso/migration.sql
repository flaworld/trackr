-- AlterTable
ALTER TABLE "users" ADD COLUMN     "entra_oid" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_entra_oid_key" ON "users"("entra_oid");

