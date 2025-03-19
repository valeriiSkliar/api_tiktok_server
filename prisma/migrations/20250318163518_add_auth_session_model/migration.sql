-- CreateTable
CREATE TABLE `AuthSession` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `storageState` JSON NOT NULL,
    `proxyId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastRefreshAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'INVALID', 'REFRESHING', 'SUSPENDED', 'ERROR') NOT NULL DEFAULT 'ACTIVE',
    `userAgent` VARCHAR(191) NULL,
    `instanceId` VARCHAR(191) NULL,
    `refreshCount` INTEGER NOT NULL DEFAULT 0,
    `failCount` INTEGER NOT NULL DEFAULT 0,
    `metadata` JSON NULL,

    INDEX `AuthSession_email_idx`(`email`),
    INDEX `AuthSession_status_expiresAt_idx`(`status`, `expiresAt`),
    INDEX `AuthSession_proxyId_idx`(`proxyId`),
    INDEX `AuthSession_lastUsedAt_idx`(`lastUsedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProxyServer` (
    `id` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL,
    `username` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `protocol` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BANNED', 'ERROR', 'RATE_LIMITED') NOT NULL DEFAULT 'ACTIVE',
    `lastCheckedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `failCount` INTEGER NOT NULL DEFAULT 0,
    `successCount` INTEGER NOT NULL DEFAULT 0,
    `metaData` JSON NULL,

    INDEX `ProxyServer_status_idx`(`status`),
    UNIQUE INDEX `ProxyServer_host_port_username_key`(`host`, `port`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
