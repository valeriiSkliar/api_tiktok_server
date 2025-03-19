import { PartialType } from '@nestjs/mapped-types';
import { CreateEmailAccountDto } from './create-email-account.dto';

export class UpdateEmailAccountDto extends PartialType(CreateEmailAccountDto) {}
