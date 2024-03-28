import connection from "../database/database.js";

export const findById = (req, res) => {
  connection.query(
    `
  SELECT id, titre, date_creation,id_user 
  FROM user WHERE id = ?`,
    [id],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.length === 0) {
        res.status(404).json({ error: "Formation non trouvé" });
      } else {
        res.status(200).json(results[0]);
      }
    }
  );
};
