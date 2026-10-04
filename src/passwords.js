const bcrypt = require('bcrypt');
const { AppError } = require('./errors');

const DEFAULT_COST = 12;
const MAX_PASSWORD_BYTES = 72;
function passwordBytes(password) {
  if (typeof password !== 'string' || !password || /\p{Cs}/u.test(password) ||
      Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new AppError('VALIDATION_ERROR', 'password must contain 1 to 72 UTF-8 bytes');
  }
  return Buffer.from(password, 'utf8');
}
async function hashPassword(password, { cost = DEFAULT_COST } = {}) {
  const bytes = passwordBytes(password);
  // Bounded operational policy; the SRS requires a minimum cost of 10.
  if (!Number.isInteger(cost) || cost < 10 || cost > 14) {
    throw new AppError('VALIDATION_ERROR', 'bcrypt cost must be an integer from 10 to 14');
  }
  try { return await bcrypt.hash(bytes, cost); }
  catch { throw new AppError('INTERNAL_ERROR', 'Password hashing failed'); }
}
async function verifyPassword(password, storedHash) {
  const bytes = passwordBytes(password);
  if (typeof storedHash !== 'string' || !/^\$2[ab]\$1[0-4]\$[./A-Za-z0-9]{53}$/.test(storedHash)) return false;
  try { return await bcrypt.compare(bytes, storedHash); }
  catch { return false; }
}
module.exports = { DEFAULT_COST, MAX_PASSWORD_BYTES, hashPassword, verifyPassword };
