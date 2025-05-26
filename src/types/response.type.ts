export enum StatusCode {
  OK = 200,
  ERROR = 500,
  BAD_REQUEST = 400,
}

export type LambdaResponseType = {
  statusCode: number;
  [t: string]: string | number | boolean;
  message: string;
};
