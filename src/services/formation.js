import connection from "../database/database.js";
import fs from 'fs';
import { deletePhoto } from "../scripts/file.js";
import dotenv from "dotenv";
import Groq from "groq-sdk";


dotenv.config();
const groq = new Groq({
  apiKey: process.env.API_KEY_GROQ
});


export const findAll = (req, res) => {
  const limit = req.limit;
  const offset = req.offset;
  const titre = req.query.titre || null;
  let tags = req.query.tags ? req.query.tags.split(',') : null;
  if (tags) {
    for (const tag of tags) {
      if (isNaN(tag))
        return res.status(400).json({ error: "ID de tag invalide" });
    }
    tags = tags.map(Number);
  }

  const nbTags = tags ? tags.length : 0;
  const tagQuery = `
  formation.id IN (
    SELECT posseder.id
    FROM posseder
    WHERE id_tag IN (:tags)
    GROUP BY posseder.id
    HAVING COUNT(DISTINCT id_tag) = :nbTags
  ) AND`;

  connection.query(`
  SELECT DISTINCT formation.id, titre, formation.description, date_creation,
    JSON_OBJECT('id', user.id, 'nom', user.nom, 'prenom', user.prenom) as user,
    IF(COUNT(tag.id) > 0, 
      JSON_ARRAYAGG(JSON_OBJECT('id', tag.id, 'nom', tag.nom)), JSON_ARRAY()) as tag
  FROM formation
  INNER JOIN user ON formation.id_user = user.id
  LEFT JOIN posseder ON formation.id = posseder.id
  LEFT JOIN tag ON posseder.id_tag = tag.id
  WHERE 
    ${nbTags > 0 ? tagQuery : ""} 
    (:titre IS NULL OR MATCH(titre) AGAINST(:titre IN BOOLEAN MODE))
  GROUP BY formation.id 
  ORDER BY MATCH(titre) AGAINST(:titre IN BOOLEAN MODE) DESC 
  LIMIT :limit 
  OFFSET :offset 
  `,
    { titre, limit, offset, tags, nbTags },
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
    formation.id, titre, formation.description, date_creation,
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
  const { titre, description, tags } = req.body;
  const id_user = req.id;
  if (!titre || !description) {
    return res.status(400).json({ error: "Body invalide" });
  }
  const dateCreation = new Date();

  connection.query(`
  INSERT INTO formation (titre, description, date_creation, id_user) 
  VALUES (?, ?, ?, ?)`,
    [titre, description, dateCreation, id_user],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        const formationId = results.insertId;
        if (tags && tags.length > 0) {
          const tagValues = tags.map(tagId => [formationId, tagId]);
          connection.query(`
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
  const { titre, description } = req.body;
  if ((!titre && !description) || isNaN(id)) {
    return res.status(400).json({ error: "Body invalide" });
  }
  connection.query(`
  UPDATE formation
  SET 
      titre = CASE WHEN :titre IS NOT NULL 
        THEN :titre ELSE titre END,
      description = CASE WHEN :description IS NOT NULL 
        THEN :description ELSE description END
  WHERE id = :id AND id_user = :id_user`,
    { id, titre, description, id_user},
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

  connection.query(`
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

  connection.query(`
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

export const sendDefaultPhoto = (req, res) => {
  res.sendFile("public/formations/default.png", { root: "." });
}

export const generate = async (req, res) => {
  const name = req.body.name;
  const chatCompletion = await groq.chat.completions.create({
    "messages": [
      {
        "role": "system",
        "content": "Tu es un expert en création de formations sur une variété de sujets. Les formations seront rédigées en Markdown, pour être visualiser avec ngx-markdown. Tu peux inclure des blocs de code en spécifiant le langage utilisé :\n```langage \na = 1\n```\nPour intégrer du code LaTeX, encadre simplement l'expression entre des symboles $, sans utiliser de blocs de code, par exemple : $f(x) = x$ ou $x$. Illustre la formation avec des graph fait avec Mermaid. Pour écrire un graph Mermaid fait le avec le forma : ```mermaid\ntype_graph\n    contenu\n```\nPour écrire des emojis dans la formation en utilisant emoji-toolkit, par exemple :heart:\n"
      },
      {
        "role": "user",
        "content": `Rédige une formation longue et détaillée sur le sujet "${name}" en français.`
      }
    ],
    "model": "llama3-70b-8192",
    "temperature": 1,
    "max_tokens": 8192,
    "top_p": 1,
    "stream": false,
    "stop": null
  });

  const data = chatCompletion.choices[0].message.content;
  res.status(200).json({ text: data });
}
