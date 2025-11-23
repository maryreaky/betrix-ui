/**
 * Simple structured logger
 */

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  constructor(name, minLevel = LogLevel.INFO) {
    this.name = name;
    this.minLevel = minLevel;
  }

  #log(level, levelName, message, data) {
    if (level < this.minLevel) return;
    const timestamp = new Date().toISOString();
    const context = `[${timestamp}] [${levelName}] [${this.name}]`;
    if (data) {
      console.log(`${context} ${message}`, data);
    } else {
      console.log(`${context} ${message}`);
    }
  }

  debug(message, data) {
    this.#log(LogLevel.DEBUG, "DEBUG", message, data);
  }

  info(message, data) {
    this.#log(LogLevel.INFO, "INFO", message, data);
  }

  warn(message, data) {
    this.#log(LogLevel.WARN, "WARN", message, data);
  }

  error(message, error) {
    const data = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    this.#log(LogLevel.ERROR, "ERROR", message, data);
  }
}

export { Logger, LogLevel };
