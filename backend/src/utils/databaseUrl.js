function buildDatabaseUrl(rawEnv) {
  if (rawEnv.DATABASE_URL) {
    return rawEnv.DATABASE_URL;
  }

  const requiredDbKeys = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const hasAllDbKeys = requiredDbKeys.every((key) => rawEnv[key]);

  if (!hasAllDbKeys) {
    return rawEnv.DATABASE_URL;
  }

  const dbDialect = rawEnv.DB_DIALECT || 'postgresql';
  const protocol = dbDialect === 'postgres' ? 'postgresql' : dbDialect;
  const username = encodeURIComponent(rawEnv.DB_USER);
  const password = encodeURIComponent(rawEnv.DB_PASSWORD);

  return `${protocol}://${username}:${password}@${rawEnv.DB_HOST}:${rawEnv.DB_PORT}/${rawEnv.DB_NAME}`;
}

function applyDatabaseUrl(rawEnv) {
  const databaseUrl = buildDatabaseUrl(rawEnv);

  if (databaseUrl) {
    rawEnv.DATABASE_URL = databaseUrl;
  }

  return databaseUrl;
}

module.exports = {
  buildDatabaseUrl,
  applyDatabaseUrl,
};
