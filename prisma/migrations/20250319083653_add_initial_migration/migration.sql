/*
  Warnings:

  - You are about to drop the column `lastCheckedAt` on the `ProxyServer` table. All the data in the column will be lost.
  - You are about to drop the column `metaData` on the `ProxyServer` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `ProxyServer` table. All the data in the column will be lost.
  - You are about to drop the column `successCount` on the `ProxyServer` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `ProxyServer_status_idx` ON `ProxyServer`;

-- AlterTable
ALTER TABLE `ProxyServer` DROP COLUMN `lastCheckedAt`,
    DROP COLUMN `metaData`,
    DROP COLUMN `status`,
    DROP COLUMN `successCount`,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `lastUsed` DATETIME(3) NULL,
    ADD COLUMN `region` VARCHAR(191) NULL,
    ADD COLUMN `successRate` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `TikTokAccount` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastAuthSuccess` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastAuthAttempt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `authFailCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TikTokAccount_username_key`(`username`),
    UNIQUE INDEX `TikTokAccount_email_key`(`email`),
    INDEX `TikTokAccount_isActive_idx`(`isActive`),
    INDEX `TikTokAccount_username_idx`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailAccount` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL DEFAULT '',
    `server` VARCHAR(191) NOT NULL DEFAULT '',
    `port` INTEGER NOT NULL DEFAULT 0,
    `protocol` VARCHAR(191) NOT NULL DEFAULT '',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `tiktokAccountId` VARCHAR(191) NULL,
    `lastChecked` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmailAccount_email_key`(`email`),
    INDEX `EmailAccount_isActive_idx`(`isActive`),
    INDEX `EmailAccount_tiktokAccountId_idx`(`tiktokAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequestSession` (
    `id` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `parameters` TEXT NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `isValid` BOOLEAN NOT NULL DEFAULT true,
    `responseStatus` INTEGER NULL,
    `proxyId` VARCHAR(191) NULL,
    `accountId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RequestSession_isValid_idx`(`isValid`),
    INDEX `RequestSession_proxyId_idx`(`proxyId`),
    INDEX `RequestSession_accountId_idx`(`accountId`),
    INDEX `RequestSession_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthData` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `csrfToken` VARCHAR(191) NOT NULL DEFAULT '',
    `cookies` TEXT NOT NULL,
    `userSign` VARCHAR(191) NOT NULL DEFAULT '',
    `timestamp` VARCHAR(191) NOT NULL DEFAULT '',
    `additionalHeaders` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AuthData_sessionId_key`(`sessionId`),
    INDEX `AuthData_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ProxyServer_isActive_idx` ON `ProxyServer`(`isActive`);

-- CreateIndex
CREATE INDEX `ProxyServer_lastUsed_idx` ON `ProxyServer`(`lastUsed`);

-- CreateIndex
CREATE INDEX `ProxyServer_region_idx` ON `ProxyServer`(`region`);

-- AddForeignKey
ALTER TABLE `EmailAccount` ADD CONSTRAINT `EmailAccount_tiktokAccountId_fkey` FOREIGN KEY (`tiktokAccountId`) REFERENCES `TikTokAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequestSession` ADD CONSTRAINT `RequestSession_proxyId_fkey` FOREIGN KEY (`proxyId`) REFERENCES `ProxyServer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequestSession` ADD CONSTRAINT `RequestSession_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `TikTokAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthData` ADD CONSTRAINT `AuthData_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `RequestSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
