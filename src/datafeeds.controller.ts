import { Controller, Get, Query } from '@nestjs/common';
import UDF from './utils/UDF';
import { responseSuccess, responseError } from './utils/response';

@Controller('datafeeds')
export class DatafeedsController {
  @Get()
  getIndex() {
    return responseSuccess({
      data: 'Welcome to the U2USwap UDF Adapter for TradingView.',
    });
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
      const symbolDetails = await UDF.symbol(symbol?.toLowerCase());
      return responseSuccess(symbolDetails);
    } catch (error) {
      return responseError((error as Error).message);
    }
  }

  @Get('history')
  async getHistory(@Query() query: any) {
    try {
      const {
        symbol,
        from,
        to,
        resolution,
        countback: _countback,
        token0,
      } = query;

      const countback = _countback || 1000;
      await UDF.loadSymbols();
      const history = await UDF.history(
        String(symbol).toLowerCase(),
        Number(from),
        Number(to),
        resolution,
        Number(countback),
      );

      return responseSuccess(history);
    } catch (error) {
      return responseError((error as Error).message);
    }
  }

  @Get('transactions')
  async getTransactions(@Query() query: any) {
    try {
      const { symbol, skip, limit } = query;
      await UDF.loadSymbols();
      const transactions = await UDF.transactions(
        String(symbol).toLowerCase(),
        Number(skip),
        Number(limit),
      );

      return transactions;
    } catch (error) {
      return responseError((error as Error).message);
    }
  }

  @Get('pair-info')
  async getPairAddress(@Query() query: any) {
    try {
      const { token0, token1 } = query;
      await UDF.loadSymbols();
      const pairAddress = await UDF.pairAddress(
        String(token0).toLowerCase(),
        String(token1).toLowerCase(),
      );
      return responseSuccess(pairAddress);
    } catch (error) {
      return responseError((error as Error).message);
    }
  }
}
