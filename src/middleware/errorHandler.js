import logger from '../scripts/logger.js';

export const handleError = (err, req, res, next) => {
  // Log the error for debugging purposes
  logger.error(err);

  // Check if the connection header indicates keep-alive
  if (req.headers.connection === "keep-alive") {
    return // next(err); // Pass the error to the next middleware or handler
  }

  // Send a 500 Internal Server Error response
  return res.status(500).json({ error: "Erreur interne du serveur" });
};
