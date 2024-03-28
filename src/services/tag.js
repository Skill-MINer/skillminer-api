import connection from "../database/database.js";

export const findAll = (req, res) => {
  const limit = req.limit;
  const offset = req.offset;
  connection.query(
    "SELECT id, nom FROM tag LIMIT ? OFFSET ?",
    [limit, offset],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.length === 0) {
        res.status(404).json({ error: "Utilisateur non trouvé" });
      } else {
        res.status(200).json(results);
      }
    }
  );
};
