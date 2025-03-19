import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { EmailAccountService } from './email-account.service';
import { CreateEmailAccountDto } from './dto/create-email-account.dto';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto';

@Controller('email-account')
export class EmailAccountController {
  constructor(private readonly emailAccountService: EmailAccountService) {}

  @Post()
  create(@Body() createEmailAccountDto: CreateEmailAccountDto) {
    return this.emailAccountService.create(createEmailAccountDto);
  }

  @Get()
  findAll() {
    return this.emailAccountService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.emailAccountService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEmailAccountDto: UpdateEmailAccountDto,
  ) {
    return this.emailAccountService.update(+id, updateEmailAccountDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.emailAccountService.remove(+id);
  }
}
