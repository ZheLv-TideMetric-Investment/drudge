const winston = require('winston');
const config = require('../config/config');

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: config.logging.file }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

module.exports = logger;
