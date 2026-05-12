const RESET  = '\x1b[0m';
const COLORS = {
  info:    '\x1b[36m',   // cyan
  success: '\x1b[32m',   // green
  warn:    '\x1b[33m',   // yellow
  error:   '\x1b[31m',   // red
  debug:   '\x1b[35m',   // magenta
};

function timestamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function log(level, tag, message) {
  const color  = COLORS[level] ?? RESET;
  const prefix = `${color}[${timestamp()}] [${tag}]${RESET}`;
  console.log(`${prefix} ${message}`);
}

module.exports = {
  info:    (tag, msg) => log('info',    tag, msg),
  success: (tag, msg) => log('success', tag, msg),
  warn:    (tag, msg) => log('warn',    tag, msg),
  error:   (tag, msg) => log('error',   tag, msg),
  debug:   (tag, msg) => log('debug',   tag, msg),
};
