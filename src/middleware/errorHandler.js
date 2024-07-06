import logger from '../scripts/logger.js';

export const handleError = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Erreur interne du serveur";

  logger.error(`Error caught in errorHandler: ${err.message}`);
    
  if (!res.headersSent) {
    return res.status(statusCode).json({ error: message });
  } else {
    return next(err);
  }
};
