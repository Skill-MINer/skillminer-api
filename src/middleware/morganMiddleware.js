import morgan from 'morgan';
import logger from '../scripts/logger.js';

const morganMiddleware = (req, res, next) => {
  morgan(
    ":remote-addr :method :url :status :res[content-length] - :response-time ms",
    {
      skip: (req, res) => res.statusCode < 400,
      stream: {
        write: (message) => {
          logger.error(message.trim());
        }
      }
    }
  )(req, res, () => {
    next();
  });

  morgan(
    ":remote-addr :method :url :status :res[content-length] - :response-time ms",
    {
      skip: (req, res) => res.statusCode >= 400,
      stream: {
        write: (message) => {
          logger.info(message.trim());
        }
      }
    }
  )(req, res, () => {
    next();
  });
};

export default morganMiddleware;