/*
  Warnings:

  - You are about to drop the column `idempotencyKeyId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `IdempotencyKey` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[idemKey]` on the table `IdempotencyKey` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bookingId]` on the table `IdempotencyKey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bookingId` to the `IdempotencyKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idemKey` to the `IdempotencyKey` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Booking` DROP FOREIGN KEY `Booking_idempotencyKeyId_fkey`;

-- DropIndex
DROP INDEX `Booking_idempotencyKeyId_key` ON `Booking`;

-- DropIndex
DROP INDEX `IdempotencyKey_key_key` ON `IdempotencyKey`;

-- AlterTable
ALTER TABLE `Booking` DROP COLUMN `idempotencyKeyId`;

-- AlterTable
ALTER TABLE `IdempotencyKey` DROP COLUMN `key`,
    ADD COLUMN `bookingId` INTEGER NOT NULL,
    ADD COLUMN `finalised` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `idemKey` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `IdempotencyKey_idemKey_key` ON `IdempotencyKey`(`idemKey`);

-- CreateIndex
CREATE UNIQUE INDEX `IdempotencyKey_bookingId_key` ON `IdempotencyKey`(`bookingId`);

-- AddForeignKey
ALTER TABLE `IdempotencyKey` ADD CONSTRAINT `IdempotencyKey_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
