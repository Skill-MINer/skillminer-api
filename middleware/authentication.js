import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const secretKey = process.env.SECRET_KEY;

export const auth = async (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token)
    return res
      .status(401)
      .json({ error: "Accès non autorisé. Token manquant." });

  try {
    const data = await jwt.verify(token, secretKey);
    req.id = data.id;
    next();
  } catch (err) {
    return res
      .status(403)
      .json({ error: "Accès non autorisé. Token invalide." });
  }
};
