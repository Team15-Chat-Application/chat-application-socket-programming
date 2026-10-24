const { readConfig } = require('../../src/config');
const { AppError, failure } = require('../../src/errors');

test('configuration defaults bind the development server to loopback', () => {
  expect(readConfig({})).toEqual({ host: '127.0.0.1', port: 3000 });
});
test.each(['1', '65535'])('valid port boundary %s is accepted', port => {
  expect(readConfig({ NODE_PORT: port }).port).toBe(Number(port));
});
test.each(['0', '65536', '-1', '3000abc', '', '3.5'])('invalid port %s fails early', port => {
  expect(() => readConfig({ NODE_PORT: port })).toThrow('NODE_PORT');
});
test('empty host fails early', () => expect(() => readConfig({ NODE_HOST: ' ' })).toThrow('NODE_HOST'));
test('known application errors retain their public code', () => {
  expect(failure(new AppError('VALIDATION_ERROR', 'Invalid input'))).toEqual({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
});
test('unexpected errors do not disclose their details', () => {
  expect(failure(new Error('private implementation detail'))).toEqual({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } });
});
