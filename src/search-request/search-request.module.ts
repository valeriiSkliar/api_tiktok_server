import { Module } from '@nestjs/common';
import { SearchRequestService } from './search-request.service';
import { SearchRequestController } from './search-request.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SearchRequestController],
  providers: [SearchRequestService, PrismaService],
  exports: [SearchRequestService],
})
export class SearchRequestModule {}
