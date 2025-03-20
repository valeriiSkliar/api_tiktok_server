import { Module } from '@nestjs/common';
import { EmailService } from '../services';
import { Log } from 'crawlee';
import { PrismaService } from '@src/prisma.service';
import { EmailAccount } from '@src/email-account/entities/email-account.entity';

@Module({
  providers: [
    PrismaService,
    {
      provide: Log,
      useFactory: () => new Log({ prefix: 'EmailService' }),
    },
    {
      provide: 'EMAIL_SERVICE',
      useFactory: (
        prisma: PrismaService,
        logger: Log,
        emailAccount: EmailAccount,
      ) => {
        return new EmailService(prisma, logger, emailAccount);
      },
      inject: [PrismaService, Log, EmailAccount],
    },
  ],
  exports: ['EMAIL_SERVICE'],
  imports: [PrismaService, EmailAccount],
})
export class EmailModule {}
