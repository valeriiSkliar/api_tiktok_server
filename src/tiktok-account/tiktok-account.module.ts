import { Module } from '@nestjs/common';
import { TiktokAccountService } from './tiktok-account.service';
import { TiktokAccountController } from './tiktok-account.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TiktokAccountController],
  providers: [TiktokAccountService],
})
export class TiktokAccountModule {}
