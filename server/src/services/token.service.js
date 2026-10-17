const jwt = require('jsonwebtoken');

const assertJwtConfiguration = () => {
  const secrets = [process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET];
  if (secrets.some(secret => typeof secret !== 'string' || secret.trim().length < 32 ||
      /your[-_ ]|change[-_ ]?this|change[-_ ]?me|punchdad_jwt_secret_key_super_safe/i.test(secret))) {
    throw new Error('JWT secrets must be independently generated random values of at least 32 characters; example keys are forbidden.');
  }
  if (secrets[0] === secrets[1]) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different.');
  }
};

const generateTokens = (user) => {
  assertJwtConfiguration();
  const payload = { userId: user.id, authVersion: user.authVersion };
  return {
    accessToken: jwt.sign({ ...payload, tokenType: 'access' }, process.env.JWT_SECRET, {
      algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    }),
    refreshToken: jwt.sign({ ...payload, tokenType: 'refresh' }, process.env.JWT_REFRESH_SECRET, {
      algorithm: 'HS256', expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    }),
  };
};

const verifyToken = (token, tokenType) => {
  assertJwtConfiguration();
  const secret = tokenType === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof decoded.userId !== 'string' || !decoded.userId ||
      !Number.isSafeInteger(decoded.authVersion) || decoded.authVersion < 0 ||
      decoded.tokenType !== tokenType) {
    throw new Error('Invalid token claims');
  }
  return decoded;
};

module.exports = { assertJwtConfiguration, generateTokens, verifyToken };
