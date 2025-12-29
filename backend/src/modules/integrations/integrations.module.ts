import { Module } from '@nestjs/common';
import { CallbackService } from './callback.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CallbackService],
  exports: [CallbackService],
})
export class IntegrationsModule {}
