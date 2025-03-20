-- DropForeignKey
ALTER TABLE `Session` DROP FOREIGN KEY `Session_api_config_id_fkey`;

-- DropForeignKey
ALTER TABLE `Session` DROP FOREIGN KEY `Session_proxy_id_fkey`;

-- AlterTable
ALTER TABLE `Session` MODIFY `proxy_id` INTEGER NULL,
    MODIFY `api_config_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_proxy_id_fkey` FOREIGN KEY (`proxy_id`) REFERENCES `Proxy`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_api_config_id_fkey` FOREIGN KEY (`api_config_id`) REFERENCES `ApiConfiguration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
