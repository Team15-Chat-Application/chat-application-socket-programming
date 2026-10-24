const sanitizeHtml = require('sanitize-html');
const { AppError } = require('./errors');

const NON_TEXT_TAGS = ['script', 'style', 'textarea', 'option', 'iframe', 'object', 'svg', 'math'];
function withinCodePoints(value, maximum) {
  if (value.length > maximum * 2) return false;
  let count = 0;
  for (const _character of value) if (++count > maximum) return false;
  return true;
}
function sanitizePlainText(value) {
  return sanitizeHtml(value, {
    allowedTags: [], allowedAttributes: {}, nonTextTags: NON_TEXT_TAGS,
    disallowedTagsMode: 'discard'
  });
}
function sanitizeUsername(value) {
  // Validation rejects ambiguous credentials rather than silently renaming a user.
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,32}$/.test(value)) {
    throw new AppError('VALIDATION_ERROR', 'username must contain 1 to 32 letters, digits, dots, underscores or hyphens');
  }
  return value;
}
function sanitizeMessage(value) {
  if (typeof value !== 'string' || !withinCodePoints(value, 2000) || !value.trim() ||
      /[\p{Cs}\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)) {
    throw new AppError('VALIDATION_ERROR', 'content must contain 1 to 2000 characters without invalid controls');
  }
  const clean = sanitizePlainText(value);
  if (!clean.trim()) throw new AppError('VALIDATION_ERROR', 'content is empty after sanitisation');
  return clean;
}
module.exports = { sanitizePlainText, sanitizeUsername, sanitizeMessage, withinCodePoints };
