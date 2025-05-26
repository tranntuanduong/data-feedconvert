export const responseSuccess = (body: any, message = 'Success') => {
  return {
    ...body,
    message,
    statusCode: 200,
    success: true,
  };
};

export const responseError = (message: string, codeError: number = 500) => {
  return {
    message,
    statusCode: codeError,
    success: false,
  };
}; 