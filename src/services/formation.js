import connection from "../database/database.js";

export const findAll = (req, res) => {
  const limit = req.limit;
  const offset = req.offset;
  const titre = req.query.titre ? req.query.titre : null;

  connection.query(
    `SELECT formation.id, titre, date_creation,
    JSON_OBJECT('id', user.id, 'nom', user.nom, 'prenom', user.prenom) as user
    FROM formation
    INNER JOIN user ON formation.id_user = user.id
    WHERE 
      CASE WHEN :titre IS NOT NULL  
        THEN MATCH(titre) AGAINST(? IN NATURAL LANGUAGE MODE) 
        ELSE 1 
      END
    LIMIT :limit  
    OFFSET :offset`,
    { titre, limit, offset },
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.length === 0) {
        res.status(404).json({ error: "Formation(s) non trouvée(s)" });
      } else {
        res.status(200).json(results);
      }
    }
  );
};

export const findById = (req, res) => {
  const id = req.params.id;

  connection.query(
    `
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
        res.status(404).json({ error: "Formation(s) non trouvée(s)" });
      } else {
        res.status(200).json(results[0]);
      }
    }
  );
};

export const add = async (req, res) => {
  const { titre, id_user } = req.body;
  if (!titre || !id_user) {
    return res.status(400).json({ error: "Body invalide" });
  }
  const dateCreation = new Date();

  connection.query(
    `
  INSERT INTO formation (titre, date_creation, id_user) 
  VALUES (?, ?, ?)`,
    [titre, dateCreation, id_user],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        const id = results.insertId;
        res.status(201).json({ id: id });
      }
    }
  );
};

export const update = (req, res) => {
  const id = parseInt(req.params.id);
  const id_user = req.id;
  const { titre } = req.body;
  if (!titre || isNaN(id)) {
    return res.status(400).json({ error: "Body invalide" });
  }
  connection.query(
    `
  UPDATE formation
  SET 
      titre = CASE WHEN :titre IS NOT NULL THEN :titre ELSE titre END
  WHERE id = :id AND id_user = :id_user`,
    { id, titre, id_user},
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.affectedRows === 0) {
        res.status(401).json({ error: "Formation non trouvée ou utilisateur non autorisé" });
      } else {
        res.status(200).json({ message: results.info });
      }
    }
  );
};

export const deleteFormation = (req, res) => {
  const id = parseInt(req.params.id);
  const id_user = req.id;
  if (isNaN(id)) {
    return res.status(400).json({ error: "Id invalide" });
  }

  connection.query(
    "DELETE FROM formation WHERE id = ? AND id_user = ?",
    [id, id_user],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.affectedRows === 0) {
        res.status(401).json({ error: "Formation non trouvée ou utilisateur non autorisé" });
      } else {
        res.status(200).json({ message: "Formation supprimée" });
      }
    }
  );
};
