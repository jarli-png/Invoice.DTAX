import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll() { return this.prisma.product.findMany(); }
  findOne(id: string) { return this.prisma.product.findUnique({ where: { id } }); }
  create(data: any) { return this.prisma.product.create({ data }); }
  update(id: string, data: any) { return this.prisma.product.update({ where: { id }, data }); }
  delete(id: string) { return this.prisma.product.delete({ where: { id } }); }
}
