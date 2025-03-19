import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TiktokAccountModule } from './tiktok-account/tiktok-account.module';
import { EmailAccountModule } from './email-account/email-account.module';

@Module({
  imports: [TiktokAccountModule, EmailAccountModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
