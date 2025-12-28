import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }),
    InvoicesModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
