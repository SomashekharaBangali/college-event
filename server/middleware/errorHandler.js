export function errorHandler(error, _request, response, _next) {
  if (response.headersSent) return;
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error('Request failed:', error.message);
  response.status(status).json({
    message: status >= 500 ? 'The request could not be completed. Close Book2.xlsx if it is open, then retry.' : error.message,
  });
}