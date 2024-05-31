import connection from "../database/database.js";
import fs from "fs";
import { deletePhoto } from "../scripts/file.js";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();
const groq = new Groq({
  apiKey: process.env.API_KEY_GROQ,
});

export const findAll = (req, res) => {
  const limit = req.limit;
  const offset = req.offset;
  const titre = req.query.titre || null;
  let tags = req.query.tags ? req.query.tags.split(",") : null;
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

  connection.query(
    `
  SELECT DISTINCT formation.id, titre, formation.description, date_creation, formation.publier,
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
    AND formation.publier = 1
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

const findByIdQuery = `
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
`;

export const findById = (req, res) => {
  const id = req.params.id;

  connection.query(findByIdQuery, [id], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (results.length === 0) {
      res.status(404).json({ error: "Formation(s) non trouvée(s)" });
    } else {
      res.status(200).json(results[0]);
    }
  });
};

export const add = (req, res) => {
  const id_user = req.id;
  const dateCreation = new Date();

  connection.query(
    "INSERT INTO formation (titre, description, date_creation, id_user) VALUES ('', '', ?, ?)",
    [dateCreation, id_user],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(201).json({ id: results.insertId });
      }
    }
  );
};

export const addContributors = (req, res) => {
  const id_new_user = req.body.id_user;
  const id_user = req.id;
  const id_formation = req.params.id;
  if (isNaN(id_new_user) || isNaN(id_formation)) {
    return res.status(400).json({ error: "ID invalide" });
  }
  connection.query(
    `SELECT id FROM formation WHERE id = ? AND id_user = ?`,
    [id_formation, id_user],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.length === 0) {
        res
          .status(401)
          .json({ error: "Utilisateur non autorisé ou formation non trouvée" });
      } else {
        connection.query(
          `
      INSERT INTO moderer (id, id_formation) VALUES (?, ?)`,
          [id_new_user, id_formation],
          (err, results) => {
            if (err) {
              res.status(500).json({ error: err.message });
            } else {
              res.status(201).json({ message: "Utilisateur ajouté" });
            }
          }
        );
      }
    }
  );
};

export const getContributors = (req, res) => {
  const id_formation = req.params.id;
  connection.query(
    `
  SELECT user.id, nom, prenom 
  FROM user 
  LEFT JOIN moderer ON user.id = moderer.id
  WHERE id_formation = ?
  GROUP BY user.id
  `,
    [id_formation],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.length === 0) {
        res.status(404).json({ error: "Aucun contributeur trouvé" });
      } else {
        res.status(200).json(results);
      }
    }
  );
};

export const addHeader = async (req, res) => {
  const { titre, description, tag } = req.body;
  const idFormation = req.params.id;
  const idUser = req.id;
  if (!titre || !description || isNaN(idFormation)) {
    return res.status(400).json({ error: "Data invalide" });
  }

  connection.query(
    `
  UPDATE formation
  SET 
    titre = :titre,
    description = :description
  WHERE id = :idFormation AND id_user = :idUser`,
    { titre, description, idUser, idFormation },
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        connection.query(
          `
        DELETE FROM posseder
        WHERE id = :idFormation`,
          { idFormation },
          (err, results) => {
            if (err) {
              res.status(500).json({ error: err.message });
            } else {
              if (tag && tag.length > 0) {
                const tagValues = tag.map((tagId) => [idFormation, tagId]);
                connection.query(
                  `
                  INSERT INTO posseder (id, id_tag) 
                  VALUES ?`,
                  [tagValues],
                  (err, results) => {
                    if (err) {
                      res.status(500).json({
                        error: err.message,
                        error_tag: "Erreur lors de l'ajout des tags",
                      });
                    } else {
                      res.status(201).json();
                    }
                  }
                );
              } else {
                res.status(201).json();
              }
            }
          }
        );
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
  connection.query(
    `
  UPDATE formation
  SET 
      titre = CASE WHEN :titre IS NOT NULL 
        THEN :titre ELSE titre END,
      description = CASE WHEN :description IS NOT NULL 
        THEN :description ELSE description END
  WHERE id = :id AND id_user = :id_user`,
    { id, titre, description, id_user },
    (err, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (results.affectedRows === 0) {
        res
          .status(401)
          .json({ error: "Utilisateur non autorisé ou formation non trouvée" });
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
        res
          .status(401)
          .json({ error: "Utilisateur non autorisé ou formation non trouvée" });
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
        res.status(401).json({
          error:
            "utilisateur non autorisé ou formation non trouvée ou tag déjà possédé ou tag non existant",
        });
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
        res.status(401).json({
          error:
            "Utilisateur non autorisé ou formation non trouvée ou le tag n'existe pas dans cette formation",
        });
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
        return res
          .status(401)
          .json({ error: "Utilisateur non autorisé ou formation non trouvée" });
      } else {
        fs.rename(req.file.path, `${req.file.destination}${id}.png`, (err) => {
          if (err) {
            return res
              .status(500)
              .send("Erreur lors de l'enregistrement du fichier");
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
};

export const generate = async (req, res) => {
  const formationTitle = req.body.formationTitle;
  const pageTitle = req.body.pageTitle;
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en création de formations sur tout les sujets. Rédige les formations en Markdown, écrit en faisant un titre Markdown de niveau 1 puis des titres Markdown de niveau 2.",
        },
        {
          role: "user",
          content: `Rédige le chapitre "${pageTitle}" d'une formation longue et détaillée sur le sujet "${formationTitle}" en français. Tu peux inclure des blocs de code en spécifiant le langage utilisé :\n\`\`\`langage \na = 1\n\`\`\`\nPour intégrer du code LaTeX, encadre simplement l'expression entre des symboles $, sans utiliser de blocs de code, par exemple : $f(x) = x$ ou $x$. Tu peux illustrer la formation avec des graph fait avec Mermaid, par exemple : \n\`\`\`mermaid\nflowchart TD\n    A[Start] --> B{Is it?}\n    B -->|Yes| C[OK]\n    C --> D[Rethink]\n    D --> B\n    B ---->|No| E[End]\n\`\`\`\nTu peux écrire des emojis dans la formation en utilisant emoji-toolkit, par exemple :heart:\n Ne met pas de = ou - sous les titres.`,
        },
      ],
      model: "llama3-70b-8192",
      temperature: 1,
      max_tokens: 8192,
      top_p: 1,
      stream: false,
      stop: null,
    });

    const message = parseMarkdownToJSON(
      chatCompletion.choices[0].message.content
    );
    if (message.length === 0) {
      return res.status(400).json({ error: "Erreur lors de la génération" });
    }
    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function parseMarkdownToJSON(markdown) {
  // Split markdown into lines
  const lines = markdown.split("\n");

  // Initialize the JSON structure
  const json = {
    id: 1,
    nom: "",
    contenu: [],
  };

  let currentSection = null;

  lines.forEach((line) => {
    // Check for main title (H1)
    if (/^# .+/.test(line)) {
      json.nom = line.replace(/^# /, "").trim();
    }

    // Check for section titles (H2)
    else if (/^## .+/.test(line)) {
      if (currentSection) {
        json.contenu.push(currentSection);
      }
      currentSection = {
        id: json.contenu.length + 1,
        title: line.replace(/^## /, "").trim(),
        contenu: {
          id: json.contenu.length + 1,
          text: "",
          type: "markdown",
        },
      };
    }

    // Capture content under H2 sections
    else if (currentSection) {
      currentSection.contenu.text += line + "\n";
    }
  });

  // Push the last section if exists
  if (currentSection) {
    json.contenu.push(currentSection);
  }

  // Clean up whitespace
  json.contenu.forEach((section) => {
    section.contenu.text = section.contenu.text.trim();
  });

  return json;
}

export const putContenu = (req, res) => {
  const id = req.params.id;
  const id_user = req.id;
  const contenus = req.body;
  if (!contenus || !Array.isArray(contenus)) {
    return res.status(400).json({ error: "Body invalide" });
  }

  connection.query(
    "DELETE FROM section WHERE id_formation = ?",
    [id],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      } else {
        const values = contenus.map(({ nom, contenu }, index) => [
          nom,
          JSON.stringify(contenu),
          index,
          id,
        ]);
        connection.query(
          "INSERT INTO section (nom, contenu, ordre, id_formation) VALUES ?",
          [values],
          (err, results) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            } else {
              return res.status(201).json({ message: "Contenu ajouté" });
            }
          }
        );
      }
    }
  );
};

export const getContenu = (req, res) => {
  const id = req.params.id;
  let data = {};
  connection.query(findByIdQuery, [id], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (results.length === 0) {
      res.status(404).json({ error: "Formation(s) non trouvée(s)" });
    } else {
      data = results[0];
      connection.query(
        `
          SELECT id, nom, contenu, ordre, id_formation
          FROM section
          WHERE id_formation = ?
          ORDER BY ordre
          `,
        [id],
        (err, results) => {
          if (err) {
            res.status(500).json({ error: err.message });
          } else {
            data.body = results.map(({ id, nom, contenu }) => ({
              id,
              nom,
              contenu,
            }));
            res.status(200).json(data);
          }
        }
      );
    }
  });
};

export const findByUser = (req, res) => {
  const id_user = req.id;
  connection.query(
    `
  SELECT formation.id, titre, formation.description, date_creation,
  JSON_OBJECT('id', user.id, 'nom', user.nom, 'prenom', user.prenom) as user,
  IF(COUNT(tag.id) > 0, 
    JSON_ARRAYAGG(JSON_OBJECT('id', tag.id, 'nom', tag.nom)), JSON_ARRAY()) as tag 
  FROM formation
  INNER JOIN user ON formation.id_user = user.id
  LEFT JOIN posseder ON formation.id = posseder.id
  LEFT JOIN tag ON posseder.id_tag = tag.id
  WHERE formation.id_user = ?
  GROUP BY formation.id
  `,
    [id_user],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      } else if (results.length === 0) {
        return res.status(404).json({ error: "Formation(s) non trouvée(s)" });
      } else {
        return res.status(200).json(results);
      }
    }
  );
};

export const publish = (req, res) => {
  const id_formation = req.params.id;
  const id_user = req.id;
  let publier = req.body.publier;
  if (!(typeof publier === "boolean" || publier === 1 || publier === 0)) {
    return res.status(400).json({ error: "Body invalide" });
  }
  publier = Boolean(publier);
  connection.query(
    `
  UPDATE formation
  SET publier = :publier
  WHERE id = :id_formation AND id_user = :id_user
  `,
    { publier, id_formation, id_user },
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      } else if (results.affectedRows === 0) {
        return res
          .status(401)
          .json({ error: "Utilisateur non autorisé ou formation non trouvée" });
      } else {
        return res.status(200).json({ message: "Publication modifiée" });
      }
    }
  );
};
