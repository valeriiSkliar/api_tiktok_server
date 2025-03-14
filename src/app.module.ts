import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SearchRequestModule } from './search-request/search-request.module';

@Module({
  imports: [SearchRequestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
