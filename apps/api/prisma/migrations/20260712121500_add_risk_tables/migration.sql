-- CreateTable
CREATE TABLE `ip_blacklist` (
    `id` VARCHAR(36) NOT NULL,
    `ip` VARCHAR(64) NOT NULL,
    `reason` TEXT NOT NULL,
    `source` VARCHAR(32) NOT NULL DEFAULT 'manual',
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ip_blacklist_ip_key`(`ip`),
    INDEX `ip_blacklist_ip_idx`(`ip`),
    INDEX `ip_blacklist_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_blacklist` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `reason` TEXT NOT NULL,
    `source` VARCHAR(32) NOT NULL DEFAULT 'manual',
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_blacklist_email_key`(`email`),
    INDEX `email_blacklist_email_idx`(`email`),
    INDEX `email_blacklist_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `risk_records` (
    `id` VARCHAR(36) NOT NULL,
    `ip` VARCHAR(64) NOT NULL,
    `email` VARCHAR(255) NULL,
    `action` VARCHAR(64) NOT NULL,
    `detail` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `risk_records_ip_createdAt_idx`(`ip`, `createdAt`),
    INDEX `risk_records_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `risk_records_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
