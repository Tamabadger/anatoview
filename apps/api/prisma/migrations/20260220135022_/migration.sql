/*
  Warnings:

  - You are about to drop the column `category` on the `animals` table. All the data in the column will be lost.
  - Added the required column `category_id` to the `animals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "anatomical_structures" ADD COLUMN     "blood_supply" TEXT,
ADD COLUMN     "clinical_note" TEXT,
ADD COLUMN     "innervation" TEXT,
ADD COLUMN     "muscle_attachments" TEXT,
ADD COLUMN     "pronunciation_url" TEXT;

-- AlterTable
ALTER TABLE "animals" DROP COLUMN "category",
ADD COLUMN     "category_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
