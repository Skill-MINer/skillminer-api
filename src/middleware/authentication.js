import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import connection from "../database/database.js";

dotenv.config();

const secretKey = process.env.SECRET_KEY;

export const auth = async (req, res, next) => {
  /* #swagger.security = [{
          "apiKeyAuth": []
  }] */
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

export const verifUserFormation = (req, res, next) => {
  const id_user = req.id;
  const id_formation = req.params.id || req.params.id_formation;

  connection.query(`
  SELECT id
  FROM moderer
  WHERE id = ? AND id_formation = ?`, [id_user, id_formation], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    } else if (results.length > 0) {
      next();
    }
  });
  connection.query(`
  SELECT id
  FROM formation
  WHERE id = ? AND id_user = ?`, [id_formation, id_user], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    } else if (results.length > 0) {
      next();
    } else {
      return res.status(403).json({ error: "Accès non autorisé." });
    }
  });
}
