import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { CustomersModule } from '../customers/customers.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [InvoicesModule, CustomersModule, OrganizationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
