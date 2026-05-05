function formatLog(level, args) {
  const timestamp = new Date().toISOString();
  const message = args.map((item) => {
    if (typeof item === 'string') {
      return item;
    }
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  }).join(' ');
  return `[${timestamp}] [${level}] ${message}`;
}

const logger = {
  info: (...args) => console.log(formatLog('INFO', args)),
  warn: (...args) => console.warn(formatLog('WARN', args)),
  error: (...args) => console.error(formatLog('ERROR', args)),
};

module.exports = logger;
