class AppError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function failure(error) {
  return {
    ok: false,
    error: error instanceof AppError
      ? { code: error.code, message: error.message }
      : { code: 'INTERNAL_ERROR', message: 'An internal error occurred' }
  };
}
module.exports = { AppError, failure };
