import { Controller, Get, Query } from '@nestjs/common';
import UDF from './utils/UDF';
import { responseSuccess, responseError } from './utils/response';

@Controller('datafeeds')
export class DatafeedsController {
  @Get()
  getIndex() {
    return responseSuccess({ data: 'Welcome to the U2USwap UDF Adapter for TradingView.' });
  }

  @Get('time')
  getTime() {
    return responseSuccess({ data: Math.floor(Date.now() / 1000) });
  }

  @Get('config')
  async getConfig() {
    try {
      const config = await UDF.config();
      return responseSuccess(config);
    } catch (error) {
      return responseError((error as Error).message);
    }
  }

  @Get('symbols')
  async getSymbols(@Query('symbol') symbol: string) {
    try {
      await UDF.loadSymbols();
      const symbolDetails = await UDF.symbol(symbol?.toLocaleLowerCase());
      return responseSuccess(symbolDetails);
    } catch (error) {
      return responseError((error as Error).message);
    }
  }

  @Get('history')
  async getHistory(@Query() query: any) {
    try {
      const { symbol, from, to, resolution, countback } = query;
      await UDF.loadSymbols();
      const history = await UDF.history(
        String(symbol).toLocaleLowerCase(),
        Number(from),
        Number(to),
        resolution,
        Number(countback)
      );
      return responseSuccess(history);
    } catch (error) {
      return responseError((error as Error).message);
    }
  }
} 