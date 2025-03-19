import { Module } from '@nestjs/common';
import { EmailAccountService } from './email-account.service';
import { EmailAccountController } from './email-account.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmailAccountController],
  providers: [EmailAccountService],
})
export class EmailAccountModule {}
