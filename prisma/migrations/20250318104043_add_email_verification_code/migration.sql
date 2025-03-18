-- CreateTable
CREATE TABLE `EmailVerificationCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `senderEmail` VARCHAR(191) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `emailBody` TEXT NULL,
    `status` ENUM('UNUSED', 'USED') NOT NULL DEFAULT 'UNUSED',
    `usedAt` DATETIME(3) NULL,
    `additionalInfo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailVerificationCode_status_idx`(`status`),
    UNIQUE INDEX `EmailVerificationCode_code_messageId_key`(`code`, `messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
