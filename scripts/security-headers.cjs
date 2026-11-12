const contentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

const referrerPolicy = 'no-referrer';
const securityHeaders = {
  'Content-Security-Policy': contentSecurityPolicy + "; frame-ancestors 'none'",
  'Referrer-Policy': referrerPolicy,
  'X-Content-Type-Options': 'nosniff'
};

module.exports = { contentSecurityPolicy, referrerPolicy, securityHeaders };
