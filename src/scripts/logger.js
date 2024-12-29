import winston, { createLogger, format, transports } from 'winston';
const { combine, timestamp, label, printf } = format;

const logFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const logTransports = [
  new winston.transports.Console({ 
    level: 'warn',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  new transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }),
  new transports.File({
    filename: 'logs/all.log'
  })
]

const logger = createLogger({
  levels: winston.config.syslog.levels,
  format: combine(
    label({ label: 'Skillminer' }),
    timestamp(),
    logFormat
  ),
  transports: logTransports
});

export default logger;