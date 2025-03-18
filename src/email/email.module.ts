// src/email/email.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from './services/EmailService';
import { Log } from 'crawlee';

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
