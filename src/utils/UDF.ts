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

const GET_TRANSACTIONS = gql`
  query MyQuery($pair: String!, $skip: Int!, $limit: Int!) {
    transactions(
      where: { swaps_: { pair: $pair } }
      first: $limit
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      timestamp
      swaps {
        amount0In
        amount0Out
        amount1In
        amount1Out
        pair {
          token0 {
            symbol
            id
          }
          token1 {
            symbol
            id
          }
          name
          id
        }
      }
      id
    }
  }
`;

const GET_PAIR_BY_TOKENS = gql`
  query MyQuery($token0: String!, $token1: String!) {
    pairs(
      where: {
        or: [
          { and: [{ token0: $token0 }, { token1: $token1 }] }
          { and: [{ token0: $token1 }, { token1: $token0 }] }
        ]
      }
    ) {
      id
      token0
      token1
    }
  }
`;

class UDF {
  private candlesClient: ApolloClient<NormalizedCacheObject>;
  private transactionsClient: ApolloClient<NormalizedCacheObject>;
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

    this.transactionsClient = new ApolloClient({
      link: new HttpLink({
        fetch,
        uri: `${process.env.GRAPH_CLIENT_TRANSACTIONS}`,
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

      // delete cache
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
        // fetchPolicy: 'cache-first',
        fetchPolicy: 'no-cache',
      });

      totalCandles = totalCandles.concat(candles);

      if (totalCandles.length === 0) {
        return { s: 'no_data' };
      } else {
        const BIG_10_18 = new BigNumber(10).pow(18);
        const s = 'ok';
        const t = totalCandles.map((c: any) => c.time);
        const o = [
          new BigNumber(1)
            .dividedBy(totalCandles[0].open)
            .multipliedBy(BIG_TOKEN_0)
            .dividedBy(BIG_TOKEN_1)
            .toJSON(),
        ].concat(
          totalCandles
            .map((c: any) =>
              new BigNumber(1)
                .dividedBy(c.close)
                .multipliedBy(BIG_TOKEN_0)
                .dividedBy(BIG_TOKEN_1)
                .toJSON(),
            )
            .slice(0, totalCandles.length - 2),
        );
        const c = totalCandles.map((c: any) =>
          new BigNumber(1)
            .dividedBy(c.close)
            .multipliedBy(BIG_TOKEN_0)
            .dividedBy(BIG_TOKEN_1)
            .toJSON(),
        );
        const h = totalCandles.map((c: any) =>
          new BigNumber(1)
            .dividedBy(c.high)
            .multipliedBy(BIG_TOKEN_0)
            .dividedBy(BIG_TOKEN_1)
            .toJSON(),
        );
        const l = totalCandles.map((c: any) =>
          new BigNumber(1)
            .dividedBy(c.low)
            .multipliedBy(BIG_TOKEN_0)
            .dividedBy(BIG_TOKEN_1)
            .toJSON(),
        );
        const v = totalCandles.map((c: any) =>
          new BigNumber(c.token1TotalAmount).div(BIG_10_18).toJSON(),
        );

        const response = t.map((time, index) => ({
          time,
          o: o[index],
          h: h[index],
          l: l[index],
          c: c[index],
          v: v[index],
        }));

        return {
          data: response,
          s,
        };
      }
    }
  }

  public async transactions(symbol: string, skip: number, limit: number) {
    const {
      data: { transactions: transactionsData },
    } = await this.transactionsClient.query({
      query: GET_TRANSACTIONS,
      variables: {
        pair: symbol.toLowerCase(),
        skip,
        limit,
      },
      fetchPolicy: 'no-cache',
    });

    const transactions = transactionsData.map((item: any) => {
      const swapItem = item?.swaps?.[0] ?? {};

      const isBuy = swapItem.amount0In === '0';

      return {
        timestamp: item.timestamp,
        txHash: item.id,
        isBuy,
        baseAmount: isBuy ? swapItem.amount0Out : swapItem.amount0In,
        quoteAmount: isBuy ? swapItem.amount1In : swapItem.amount1Out,
      };
    });

    return transactions;
  }

  public async pairAddress(token0: string, token1: string) {
    const {
      data: { pairs },
    } = await this.candlesClient.query({
      query: GET_PAIR_BY_TOKENS,
      variables: {
        token0: token0.toLowerCase(),
        token1: token1.toLowerCase(),
      },
    });

    const pair = pairs[0];

    return {
      pairInfo: {
        token0: pair.token0,
        token1: pair.token1,
        pairAddress: pair.id,
      },
    };
  }
}

export default new UDF();
