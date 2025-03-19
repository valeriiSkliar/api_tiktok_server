import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTiktokAccountDto } from './dto/create-tiktok-account.dto';
import { UpdateTiktokAccountDto } from './dto/update-tiktok-account.dto';
import { TikTokAccount } from '@prisma/client';

@Injectable()
export class TiktokAccountService {
  constructor(private prisma: PrismaService) {}

  async create(
    createTiktokAccountDto: CreateTiktokAccountDto,
  ): Promise<TikTokAccount> {
    const { emailAccountId, ...accountData } = createTiktokAccountDto;
    return await this.prisma.tikTokAccount.create({
      data: {
        ...accountData,
        email_account: {
          connect: { id: emailAccountId },
        },
      },
    });
  }

  async findAll(): Promise<TikTokAccount[]> {
    return await this.prisma.tikTokAccount.findMany({
      include: {
        email_account: true,
      },
    });
  }

  async findOne(id: number): Promise<TikTokAccount | null> {
    return await this.prisma.tikTokAccount.findUnique({
      where: { id },
      include: {
        email_account: true,
      },
    });
  }

  async update(
    id: number,
    updateTiktokAccountDto: UpdateTiktokAccountDto,
  ): Promise<TikTokAccount> {
    return await this.prisma.tikTokAccount.update({
      where: { id },
      data: updateTiktokAccountDto,
    });
  }

  async remove(id: number): Promise<TikTokAccount> {
    return await this.prisma.tikTokAccount.delete({
      where: { id },
    });
  }
}
