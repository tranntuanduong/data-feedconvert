import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatafeedsController } from './datafeeds.controller';

@Module({
  imports: [],
  controllers: [AppController, DatafeedsController],
  providers: [AppService],
})
export class AppModule {}
