const crypto = require('crypto');

function signAliExpressParams(params, appSecret) {
  const sortedKeys = Object.keys(params)
    .filter((key) => key !== 'sign' && params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort();

  const paramString = sortedKeys.map((key) => `${key}${params[key]}`).join('');
  const toSign = `${appSecret}${paramString}${appSecret}`;

  return crypto.createHash('md5').update(toSign, 'utf8').digest('hex').toUpperCase();
}

function getAliExpressTimestamp() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const gmt8 = new Date(utc + 8 * 3600000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${gmt8.getFullYear()}-${pad(gmt8.getMonth() + 1)}-${pad(gmt8.getDate())} ${pad(gmt8.getHours())}:${pad(gmt8.getMinutes())}:${pad(gmt8.getSeconds())}`;
}

module.exports = { signAliExpressParams, getAliExpressTimestamp };
