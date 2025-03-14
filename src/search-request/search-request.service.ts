import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchRequestService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.SearchRequestCreateInput) {
    const searchRequest = await this.prisma.searchRequest.create({
      data,
    });
    return searchRequest.id;
  }

  async findAll() {
    return this.prisma.searchRequest.findMany();
  }

  async findOne(id: number) {
    return this.prisma.searchRequest.findUnique({
      where: { id },
    });
  }

  async update(id: number, data: Prisma.SearchRequestUpdateInput) {
    return this.prisma.searchRequest.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    return this.prisma.searchRequest.delete({
      where: { id },
    });
  }
}
