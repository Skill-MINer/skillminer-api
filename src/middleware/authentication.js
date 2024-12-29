import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import db from "../database/database.js";
import util from 'util';

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

export const verifUserFormation = async (req, res, next) => {
  const id_user = req.id;
  const id_formation = req.params.id || req.params.id_formation;

  try {
    const modererResults = await db.query(
      "SELECT id FROM moderer WHERE id = ? AND id_formation = ?",
      [id_user, id_formation]
    );

    if (modererResults.length > 0) {
      return next();
    }

    const formationResults = await db.query(
      "SELECT id FROM formation WHERE id = ? AND id_user = ?",
      [id_formation, id_user]
    );

    if (formationResults.length > 0) {
      return next();
    }

    return res.status(403).json({ error: "Accès non autorisé !" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};