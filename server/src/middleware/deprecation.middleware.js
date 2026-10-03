// Keep legacy requests in-process so bodies, auth and handler behavior are preserved.
const deprecate = canonicalPath => (req, res, next) => {
  const target = canonicalPath.replace(/:([A-Za-z]+Id)/g, (_, key) => encodeURIComponent(req.params[key]));
  res.set('X-API-Deprecated', 'true');
  res.set('Link', `<${target}>; rel="alternate"`);
  next();
};

module.exports = { deprecate };
