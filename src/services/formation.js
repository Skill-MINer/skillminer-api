import connection from "../database/database.js";

export const findById = (req, res) => {
  const id = req.params.id;

  connection.query(`
  SELECT 
    formation.id, titre, date_creation,
    JSON_OBJECT('id', user.id, 'nom', user.nom, 'prenom', user.prenom) as user
  FROM formation
  INNER JOIN user ON formation.id_user = user.id
  WHERE formation.id = ?
  `,
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
