import connection from "../database/database.js";

export const findAll = (req, res) => {
  req.query.limit = parseInt(req.query.limit);
  req.query.offset = parseInt(req.query.offset);
  const limit =
    req.query.limit < 50 && req.query.limit > 0 ? req.query.limit : 10;
  const offset = req.query.offset > 0 ? req.query.offset : 0;

  if (isNaN(limit) || isNaN(offset)) {
    return res
      .status(400)
      .json({ error: "Mauvais format de la limite ou du décalage" });
  }

  connection.query(
    "SELECT id, titre, date_creation FROM user LIMIT ? OFFSET ? ",
    [limit, offset],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.length === 0) {
        res.status(404).json({ error: "Formation(s) non trouvée" });
      } else {
        res.status(200).json(results);
      }
    }
  );
};

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
        res.status(404).json({ error: "Formation non trouvée" });
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
  INSERT INTO user (titre, date_creation, id_user) 
  VALUES (?, ?, ?)`,
    [titre, dateCreation, id_user],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        const id = results.insertId;
        res.status(201).json({ id: id, token: createToken(id) });
      }
    }
  );
};

export const update = (req, res) => {
  const id = req.params.id;
  const { titre } = req.body;
  if (!titre) {
    return res.status(400).json({ error: "Body invalide" });
  }
  connection.query(
    `
  UPDATE formation
  SET 
      titre = CASE WHEN :titre IS NOT NULL 
            THEN :titre ELSE titre END,
  WHERE id = :id`,
    { id, titre },
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.affectedRows === 0) {
        res.status(404).json({ error: "Formation non trouvée" });
      } else {
        res.status(200).json({ message: results.info });
      }
    }
  );
};
