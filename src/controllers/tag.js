import db from "../database/database.js";
import { tryCatchWrapper } from "../middleware/tryCatchWrapper.js";
import { createCustomError } from "../scripts/customError.js";

export const getTags = tryCatchWrapper(async function (req, res, next) {
  const limit = req.query.limit ? parseInt(req.query.limit) : null;

  let sql = "SELECT id, nom FROM tag ORDER BY nom ASC";
  let queryParams = [];

  if (limit) {
    sql += " LIMIT ?";
    queryParams.push(limit);
  }

  const [rows] = await db.query(sql, queryParams);

  if (!rows.length) {
    return res.status(404).json({ error: "Tags non trouvés" });
  }
  return res.status(200).json(rows);
});

export const addTag = tryCatchWrapper(async function (req, res, next) {
  const { nom } = req.body;

  if (!nom) {
    return next(createCustomError("Body invalide", 400));
  }

  let sql = "INSERT INTO tag (nom) VALUES (?)";
  const [rows] = await db.query(sql, [nom]);

  return res.status(201).json({ id: rows[0].insertId, nom });
});
