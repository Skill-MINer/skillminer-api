import connection from "../database/database.js";
import fs from 'fs';
import { deletePhoto } from "../scripts/file.js";

export const findAll = (req, res) => {
  const limit = req.limit;
  const offset = req.offset;
  const titre = req.query.titre || null;

  connection.query(
    `SELECT formation.id, titre, date_creation,
    JSON_OBJECT('id', user.id, 'nom', user.nom, 'prenom', user.prenom) as user,
    IF(COUNT(tag.id) > 0, 
      JSON_ARRAYAGG(JSON_OBJECT('id', tag.id, 'nom', tag.nom)), JSON_ARRAY()) as tag
    FROM formation
    INNER JOIN user ON formation.id_user = user.id
    LEFT JOIN posseder ON formation.id = posseder.id
    LEFT JOIN tag ON posseder.id_tag = tag.id
    WHERE 
      (:titre IS NULL OR MATCH(titre) AGAINST(:titre IN BOOLEAN MODE))
    GROUP BY formation.id
    ORDER BY MATCH(titre) AGAINST(:titre IN BOOLEAN MODE) DESC
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
    JSON_OBJECT('id', user.id, 'nom', user.nom, 'prenom', user.prenom) as user,
    IF(COUNT(tag.id) > 0, 
      JSON_ARRAYAGG(JSON_OBJECT('id', tag.id, 'nom', tag.nom)), JSON_ARRAY()) as tag 
  FROM formation
  INNER JOIN user ON formation.id_user = user.id
  LEFT JOIN posseder ON formation.id = posseder.id
  LEFT JOIN tag ON posseder.id_tag = tag.id
  WHERE formation.id = ?
  GROUP BY formation.id
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
  const { titre, tags } = req.body;
  const id_user = req.id;
  if (!titre) {
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
        const formationId = results.insertId;
        if (tags && tags.length > 0) {
          const tagValues = tags.map(tagId => [formationId, tagId]);
          connection.query(
            `
            INSERT INTO posseder (id, id_tag) 
            VALUES ?`,
            [tagValues],
            (err, results) => {
              if (err) {
                res.status(500).json({ error: err.message, error_tag: "Erreur lors de l'ajout des tags" });
              } else {
                res.status(201).json({ id: formationId });
              }
            }
          );
        } else {
          res.status(201).json({ id: formationId });
        }
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
        res.status(401).json({ error: "Utilisateur non autorisé ou formation non trouvée" });
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
        res.status(401).json({ error: "Utilisateur non autorisé ou formation non trouvée" });
      } else {
        res.status(200).json({ message: "Formation supprimée" });
      }
    }
  );
};

export const addTags = (req, res) => {
  const id_formation = req.params.id;
  const id_tag = req.body.id_tag;
  const id_user = req.id;
  if (!id_tag) {
    return res.status(400).json({ error: "Body invalide" });
  }

  connection.query(
    `
    INSERT INTO posseder (id, id_tag) 
    SELECT :id_formation, :id_tag 
    FROM formation 
    WHERE id = :id_formation AND id_user = :id_user
    `,
    { id_formation, id_tag, id_user },
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.affectedRows === 0) {
        res.status(401).json({ error: "utilisateur non autorisé ou formation non trouvée ou tag déjà possédé ou tag non existant" });
      } else {
        res.status(201).json({ message: "Tag ajouté" });
      }
    }
  );
};

export const removeTag = (req, res) => {
  const id_formation = req.params.id;
  const id_tag = req.body.id_tag;
  const id_user = req.id;
  
  if (!id_tag) {
    return res.status(400).json({ error: "ID de tag invalide" });
  }

  connection.query(
    `
    DELETE FROM posseder
    WHERE id = :id_formation
      AND id_tag = :id_tag
      AND id IN (
        SELECT id
        FROM formation
        WHERE id = :id_formation
          AND id_user = :id_user
      )
    `,
    { id_formation, id_tag, id_user },
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.affectedRows === 0) {
        res.status(401).json({ error: "Utilisateur non autorisé ou formation non trouvée ou le tag n'existe pas dans cette formation" });
      } else {
        res.status(200).json({ message: "Tag supprimé de la formation" });
      }
    }
  );
};

export const uploadPhoto = (req, res) => {
  const id = req.params.id;
  const id_user = req.id;
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID invalide" });
  }
  connection.query(
    "SELECT id_user FROM formation WHERE id = ? AND id_user = ?",
    [id, id_user],
    (err, results) => {
      if (err) {    
        deletePhoto(req.file.path);    
        return res.status(500).json({ error: err.message });
      } else if (results.length === 0) {
        deletePhoto(req.file.path);
        return res.status(401).json({ error: "Utilisateur non autorisé ou formation non trouvée" });
      } else {
        fs.rename(req.file.path, `${req.file.destination}${id}.png`, (err) => {
          if (err) {
            return res.status(500).send("Erreur lors de l'enregistrement du fichier");
          } else {
            return res.status(200).json({ message: "Photo enregistré" });
          }
        });
      }
    }
  );
};