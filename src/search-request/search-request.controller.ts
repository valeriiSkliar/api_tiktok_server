import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { SearchRequestService } from './search-request.service';
import { Prisma } from '@prisma/client';

@Controller('search-requests')
export class SearchRequestController {
  constructor(private readonly searchRequestService: SearchRequestService) {}

  @Post()
  create(@Body() createSearchRequestDto: Prisma.SearchRequestCreateInput) {
    return this.searchRequestService.create(createSearchRequestDto);
  }

  @Get()
  findAll() {
    return this.searchRequestService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.searchRequestService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSearchRequestDto: Prisma.SearchRequestUpdateInput,
  ) {
    return this.searchRequestService.update(+id, updateSearchRequestDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.searchRequestService.remove(+id);
  }
}
