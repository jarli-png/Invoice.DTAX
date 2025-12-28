import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../invoices/storage.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  findAll() { return this.prisma.organization.findMany({ where: { isActive: true } }); }
  findOne(id: string) { return this.prisma.organization.findUnique({ where: { id } }); }
  findDefault() { return this.prisma.organization.findFirst({ where: { isDefault: true } }); }
  create(data: any) { return this.prisma.organization.create({ data }); }
  update(id: string, data: any) { return this.prisma.organization.update({ where: { id }, data }); }
  deactivate(id: string) { return this.prisma.organization.update({ where: { id }, data: { isActive: false } }); }

  async uploadLogo(id: string, buffer: Buffer, mimeType: string) {
    const logoUrl = await this.storageService.uploadLogo(id, buffer, mimeType);
    return this.prisma.organization.update({ where: { id }, data: { logoUrl } });
  }
}
