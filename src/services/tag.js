import connection from "../database/database.js";

export const findAll = (req, res) => {
  connection.query(
    "SELECT id, nom FROM tag ORDER BY nom ASC",
    [],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      } else if (results.length === 0) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      } else {
        return res.status(200).json(results);
      }
    }
  );
};

export const add = (req, res) => {
  const { nom } = req.body;
  if (!nom) {
    return res.status(400).json({ error: "Body invalide" });
  }

  connection.query(
    "INSERT INTO tag (nom) VALUES (?)",
    [nom],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      } else {
        const id = results.insertId;
        return res.status(201).json({ id: id, nom: nom });
      }
    }
  );
};
