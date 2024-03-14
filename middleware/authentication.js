import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const secretKey = process.env.SECRET_KEY;

export const auth = (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token)
    return res
      .status(401)
      .json({ error: "Accès non autorisé. Token manquant." });

  jwt.verify(token, secretKey, (err, user) => {
    if (err)
      return res
        .status(403)
        .json({ error: "Accès non autorisé. Token invalide." });
    req.user = user;
    next();
  });
};