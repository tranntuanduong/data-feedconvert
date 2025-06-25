import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
} from '@apollo/client/core';
import BigNumber from 'bignumber.js';
import fetch from 'cross-fetch';
import gql from 'graphql-tag';

const ALL_PAIRS = gql`
  query allPairs($limit: Int!) {
    pairs(first: $limit) {
      id
      token0
      token1
    }
  }
`;

const GET_CANDLES = gql`
  query candles(
    $period: Int!
    $from: Int!
    $to: Int!
    $token0: String!
    $token1: String!
    $limit: Int!
  ) {
    candles(
      first: $limit
      orderBy: time
      orderDirection: asc
      where: {
        period: $period
        token0: $token0
        token1: $token1
        time_gte: $from
        time_lte: $to
      }
    ) {
      id
      time
      open
      close
      low
      high
      token0TotalAmount
      token1TotalAmount
    }
  }
`;

class UDF {
  private candlesClient: ApolloClient<NormalizedCacheObject>;
  private supportedResolutions: string[];
  private symbols: any[] = [];
  private allSymbols = new Set<string>();

  constructor() {
    this.candlesClient = new ApolloClient({
      link: new HttpLink({
        fetch,
        uri: `${process.env.GRAPH_CLIENT}`,
      }),
      cache: new InMemoryCache(),
    });
    this.supportedResolutions = ['5', '15', '60', '240', '1D', '7D'];
  }

  public async loadSymbols() {
    try {
      const {
        data: { pairs },
      } = await this.candlesClient.query({
        query: ALL_PAIRS,
        variables: {
          limit: 500,
        },
        fetchPolicy: 'cache-first',
      });

      this.symbols = pairs.map((pair: any) => ({
        symbol: pair.id,
        ticker: pair.id,
        name: pair.id,
        full_name: pair.id,
        token0: pair.token0,
        token1: pair.token1,
        token0Decimals: 18,
        token1Decimals: 18,
        description: `${pair.token0}/${pair.token1}`,
        exchange: 'FIRESTARTER',
        listed_exchange: 'FIRESTARTER',
        type: 'crypto',
        currency_code: pair.token1,
        session: '24x7',
        timezone: 'UTC',
        minmovement: 1,
        minmov: 1,
        minmovement2: 0,
        minmov2: 0,
        pricescale: 1,
        supported_resolutions: this.supportedResolutions,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        data_status: 'streaming',
      }));

      this.allSymbols = new Set(this.symbols.map((pair: any) => pair.symbol));
    } catch (error) {
      console.log(error);
    }
  }

  private checkSymbol(symbol: string): boolean {
    return this.allSymbols.has(symbol);
  }

  public async config() {
    return {
      exchanges: [
        {
          value: 'U2USWAP',
          name: 'U2USwap',
          desc: 'U2USwap DEX',
        },
      ],
      symbol_types: [
        {
          value: 'crypto',
          name: 'cryptocurrency',
        },
      ],
      supported_resolutions: this.supportedResolutions,
      supports_search: true,
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: true,
    };
  }

  public async symbol(symbol: string) {
    const allSymbols = this.allSymbols;
    const hasSymbol = allSymbols.has(symbol);
    if (!hasSymbol) {
      throw new Error('Symbol not found');
    }
    return this.symbols.find((value: any) => value.symbol === symbol);
  }

  public async history(
    symbol: string,
    from: number,
    to: number,
    resolution: string,
    countback: number,
  ) {
    const hasSymbol = this.checkSymbol(symbol);
    if (!hasSymbol) {
      throw new Error('Symbol not found');
    }
    const data = this.symbols.find((value: any) => value.symbol === symbol);
    // const RESOLUTIONS_INTERVALS_MAP: Record<string, number> = {
    //   5: 60 * 5,
    //   15: 60 * 15,
    //   60: 60 * 60,
    //   240: 60 * 60 * 4,
    //   '1D': 60 * 60 * 24,
    //   '7D': 60 * 60 * 24 * 7,
    // };
    const interval: number = +resolution;
    if (!interval) {
      throw new Error('Invalid resolution');
    }
    if (!data) {
      throw new Error('Symbol not found');
    }
    let totalCandles: any[] = [];
    const token0 = data.token0;
    const token1 = data.token1;
    const BIG_TOKEN_0 = new BigNumber(10).pow(18 - data.token0Decimals);
    const BIG_TOKEN_1 = new BigNumber(10).pow(18 - data.token1Decimals);
    while (true) {
      const {
        data: { candles },
      } = await this.candlesClient.query({
        query: GET_CANDLES,
        variables: {
          period: interval,
          from: parseInt(from + ''),
          to: parseInt(to + ''),
          token0,
          token1,
          limit: countback,
        },
        fetchPolicy: 'cache-first',
      });
      totalCandles = totalCandles.concat(candles);
      if (totalCandles.length === 0) {
        return { s: 'no_data' };
      } else {
        const BIG_10_18 = new BigNumber(10).pow(18);
        const times = totalCandles.map((c: any) => c.time);
        const opens = [
          new BigNumber(totalCandles[0].open)
            .multipliedBy(BIG_TOKEN_0)
            .dividedBy(BIG_TOKEN_1)
            .toFixed(12),
        ].concat(
          totalCandles
            .map((c: any) =>
              new BigNumber(c.close)
                .multipliedBy(BIG_TOKEN_0)
                .dividedBy(BIG_TOKEN_1)
                .toFixed(12),
            )
            .slice(0, totalCandles.length - 2),
        );
        const closes = totalCandles.map((c: any) =>
          new BigNumber(c.close)
            .multipliedBy(BIG_TOKEN_0)
            .dividedBy(BIG_TOKEN_1)
            .toFixed(12),
        );
        const highs = totalCandles.map((c: any) =>
          new BigNumber(c.high)
            .multipliedBy(BIG_TOKEN_0)
            .dividedBy(BIG_TOKEN_1)
            .toFixed(12),
        );
        const lows = totalCandles.map((c: any) =>
          new BigNumber(c.low)
            .multipliedBy(BIG_TOKEN_0)
            .dividedBy(BIG_TOKEN_1)
            .toFixed(12),
        );

        return {
          data: times.map((time, index) => ({
            time,
            o: 1 / +opens[index],
            h: 1 / +highs[index],
            l: 1 / +lows[index],
            c: 1 / +closes[index],
          })),
        };
      }
    }
  }
}

export default new UDF();
