const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, '../../data/tokens.json');

function ensureDataDir() {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadTokens() {
  try {
    ensureDataDir();
    if (!fs.existsSync(TOKEN_FILE)) return {};
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveTokens(tokens) {
  ensureDataDir();
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

function getAliExpressToken() {
  const tokens = loadTokens();
  if (!tokens.aliexpress) return null;
  if (tokens.aliexpress.expires_at && Date.now() > tokens.aliexpress.expires_at) {
    return null;
  }
  return tokens.aliexpress;
}

function setAliExpressToken(tokenData) {
  const tokens = loadTokens();
  tokens.aliexpress = {
    ...tokenData,
    saved_at: Date.now(),
    expires_at: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
  };
  saveTokens(tokens);
  return tokens.aliexpress;
}

module.exports = { getAliExpressToken, setAliExpressToken, loadTokens };
