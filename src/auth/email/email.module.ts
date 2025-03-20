// src/email/email.module.ts
import { Module } from '@nestjs/common';
import { EmailService } from '../services/email/EmailService';
import { Log } from 'crawlee';
import { PrismaService } from '@src/prisma.service';

@Module({
  providers: [
    PrismaService,
    {
      provide: Log,
      useFactory: () => new Log({ prefix: 'EmailService' }),
    },
    {
      provide: 'EMAIL_SERVICE',
      useFactory: (prisma: PrismaService, logger: Log) => {
        return new EmailService(prisma, logger);
      },
      inject: [PrismaService, Log],
    },
  ],
  exports: ['EMAIL_SERVICE'],
})
export class EmailModule {}
