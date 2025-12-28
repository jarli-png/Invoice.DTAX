import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.customer.findMany({
      include: { invoices: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: { invoices: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.customer.findFirst({ where: { email } });
  }

  async create(data: any) {
    // Generer kundenummer (starter på 10001)
    const lastCustomer = await this.prisma.customer.findFirst({
      where: { customerNumber: { not: null } },
      orderBy: { customerNumber: 'desc' },
    });
    const nextNumber = (lastCustomer?.customerNumber || 10000) + 1;

    return this.prisma.customer.create({
      data: {
        ...data,
        customerNumber: nextNumber,
      },
      include: { invoices: true },
    });
  }

  update(id: string, data: any) {
    return this.prisma.customer.update({
      where: { id },
      data,
      include: { invoices: true },
    });
  }

  delete(id: string) {
    return this.prisma.customer.delete({ where: { id } });
  }

  // Oppdater eksisterende kunder uten kundenummer
  async assignMissingCustomerNumbers() {
    const customersWithoutNumber = await this.prisma.customer.findMany({
      where: { customerNumber: null },
      orderBy: { createdAt: 'asc' },
    });

    const lastCustomer = await this.prisma.customer.findFirst({
      where: { customerNumber: { not: null } },
      orderBy: { customerNumber: 'desc' },
    });
    let nextNumber = (lastCustomer?.customerNumber || 10000) + 1;

    for (const customer of customersWithoutNumber) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { customerNumber: nextNumber++ },
      });
    }

    return { updated: customersWithoutNumber.length };
  }
}
