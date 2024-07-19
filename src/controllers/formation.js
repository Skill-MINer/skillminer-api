import db from "../database/database.js";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { tryCatchWrapper } from "../middleware/tryCatchWrapper.js";
import { createCustomError } from "../scripts/customError.js";


dotenv.config();
const groq = new Groq({
  apiKey: process.env.API_KEY_GROQ,
});

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

export const findAll = tryCatchWrapper(async function (req, res, next) {
  const limit = req.limit;
  const offset = req.offset;
  const titre = req.query.titre || null;
  let tags = req.query.tags ? req.query.tags.split(",") : null;
  if (tags) {
    for (const tag of tags) {
      if (isNaN(tag))
        return next(createCustomError("ID de tag invalide", 400));
    }
    tags = tags.map(Number);
  }
  const titreLike = `%${titre}%`;
  const nbTags = tags ? tags.length : 0;
  const tagQuery = `
  formation.id IN (
    SELECT posseder.id
    FROM posseder
    WHERE id_tag IN (:tags)
    GROUP BY posseder.id
    HAVING COUNT(DISTINCT id_tag) = :nbTags
  ) AND`;

  let sql = `
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
      ((:titre IS NULL OR MATCH(titre) AGAINST(:titre IN NATURAL LANGUAGE MODE)) OR titre LIKE :titreLike)
      AND formation.publier = 1
    GROUP BY formation.id
    ORDER BY MATCH(titre) AGAINST(:titre IN NATURAL LANGUAGE MODE) DESC
    LIMIT :limit
    OFFSET :offset
  `;
  const values = { titre, limit, offset, tags, nbTags, titreLike };

  const [rows] = await db.query(sql, values);

  if (!rows.length) {
    return next(createCustomError("Formations non trouvées.", 204));
  }
  return res.status(200).json(rows);
});

export const findById = tryCatchWrapper(async function (req, res, next) {
  const id = req.params.id;
  const [rows] = await db.query(findByIdQuery, [id]);

  if (!rows.length) {
    return next(createCustomError("Formation non trouvée.", 204));
  }
  return res.status(200).json(rows[0]);
});

export const add = tryCatchWrapper(async function (req, res, next) {
  const id_user = req.id;
  const dateCreation = new Date();

  let sql = "INSERT INTO formation (titre, description, date_creation, id_user) VALUES ('', '', ?, ?)";
  const [rows] = await db.query(sql, [dateCreation, id_user]);

  const id_formation = rows[0].insertId;
  let sqlUser = "SELECT id, nom, prenom, email FROM user WHERE id = ?";
  const [rowsUser] = await db.query(sqlUser, [id_user]);

  if (!rowsUser.length) {
    return next(createCustomError("Utilisateur non trouvé", 204));
  }
  return res.status(201).json({ id: id_formation, user: rowsUser[0] });
});

export const addContributors = tryCatchWrapper(async function (req, res, next) {
  const new_email = req.body.email;
  const id_user = req.id;
  const id_formation = req.params.id;
  if (new_email == undefined || isNaN(id_formation)) {
    return next(createCustomError("Données invalides", 400));
  }

  let sql = "SELECT id FROM user WHERE email = ?";
  const [rows] = await db.query(sql, [new_email]);

  if (!rows.length) {
    return next(createCustomError("Utilisateur non trouvé", 204));
  }

  const id_new_user = rows[0].id;
  sql = "SELECT id FROM formation WHERE id = ? AND id_user = ?";
  const [rowsFormation] = await db.query(sql, [id_formation, id_user]);

  if (!rowsFormation.length) {
    return next(createCustomError("Utilisateur non autorisé ou formation non trouvée", 401));
  }

  sql = "INSERT INTO moderer (id, id_formation) VALUES (?, ?)";
  await db.query(sql, [id_new_user, id_formation]);
  return res.status(201).json({ message: "Utilisateur ajouté" });
});

export const getContributors = tryCatchWrapper(async function (req, res, next) {
  const id_formation = req.params.id;

  let sql = `
    SELECT user.id, nom, prenom, email 
    FROM user 
    LEFT JOIN moderer ON user.id = moderer.id
    WHERE id_formation = ?
    GROUP BY user.id
  `;
  const [rows] = await db.query(sql, [id_formation]);

  if (!rows.length) {
    return next(createCustomError("Aucun contributeur trouvé", 204));
  }
  return res.status(200).json(rows[0]);
});

export const getEditors = tryCatchWrapper(async function (req, res, next) {
  const id_formation = req.params.id;

  let sql = `
    SELECT user.id, nom, prenom, email
    FROM user
    INNER JOIN formation ON user.id = formation.id_user
    WHERE formation.id = ?
  `;
  const [rows] = await db.query(sql, [id_formation]);

  sql = `
    SELECT user.id, nom, prenom, email 
    FROM user 
    LEFT JOIN moderer ON user.id = moderer.id
    WHERE id_formation = ?
    GROUP BY user.id
  `;
  const [rowsContributors] = await db.query(sql, [id_formation]);

  return res.status(200).json([...rows[0], ...rowsContributors[0]]);
});

export const getContributorsByToken = tryCatchWrapper(async function (req, res, next) {
  const id_formation = req.params.id;
  const id_user = req.id;

  let sql = `
      SELECT user.id
      FROM user 
      INNER JOIN moderer ON user.id = moderer.id
      INNER JOIN formation ON moderer.id_formation = formation.id
      WHERE formation.id = ? AND moderer.id = ?
      GROUP BY user.id
    `;
  const [rows] = await db.query(sql, [id_formation, id_user]);

  if (!rows.length) {
    sql = `
        SELECT id_user
        FROM formation
        WHERE id = ? AND id_user = ?
      `;
    const [rowsFormation] = await db.query(sql, [id_formation, id_user]);

    if (!rowsFormation.length) {
      return next(createCustomError("Non autorisé", 401));
    }
    return res.status(200).json();
  }
  return res.status(200).json();
});

export const addHeader = tryCatchWrapper(async function (req, res, next) {
  const { titre, description, tag } = req.body;
  const idFormation = req.params.id;
  if (!titre || !description || isNaN(idFormation)) {
    return next(createCustomError("Données invalides", 400));
  }

  let sql = `
    UPDATE formation
    SET titre = ?, description = ?
    WHERE id = ?
  `;
  await db.query(sql, [titre, description, idFormation]);

  sql = `
    DELETE FROM posseder
    WHERE id = ?
  `;
  await db.query(sql, [idFormation]);

  if (tag && tag.length > 0) {
    const tagValues = tag.map((tagId) => [idFormation, tagId]);
    sql = `
      INSERT INTO posseder (id, id_tag)
      VALUES ?
    `;
    await db.query(sql, [tagValues]);
  }
  
  const [rows] = await db.query(findByIdQuery, [idFormation]);
  if (!rows.length) {
    return next(createCustomError("Formation non trouvée", 204));
  }
  return res.status(201).json(rows[0]);
});

export const update = tryCatchWrapper(async function (req, res, next) {
  const id = parseInt(req.params.id);
  const id_user = req.id;
  const { titre, description } = req.body;
  if ((!titre && !description) || isNaN(id)) {
    return next(createCustomError("Données invalides", 400));
  }

  let sql = `
    UPDATE formation
    SET
      titre = CASE WHEN ? IS NOT NULL THEN ? ELSE titre END,
      description = CASE WHEN ? IS NOT NULL THEN ? ELSE description END
    WHERE id = ? AND id_user = ?
  `;
  const [rows] = await db.query(sql, [titre, titre, description, description, id, id_user]);

  if (!rows.affectedRows) {
    return next(createCustomError("Utilisateur non autorisé ou formation non trouvée", 401));
  }
  return res.status(200).json({ message: "Formation mise à jour" });
});

export const deleteFormation = tryCatchWrapper(async function (req, res, next) {
  const idFormation = req.params.id;
  const idUser = req.id;

  let sql = "SELECT id FROM formation WHERE id = ? AND id_user = ?";
  const [rows] = await db.query(sql, [idFormation, idUser]);

  if (!rows.length) {
    return next(createCustomError("Formation non trouvée", 204));
  }

  sql = "DELETE FROM formation WHERE id = ?";
  await db.query(sql, [idFormation]);
  return res.status(200).json({ message: "Formation supprimée" });
});

export const addTags = tryCatchWrapper(async function (req, res, next) {
  const id_formation = req.params.id;
  const id_tag = req.body.id_tag;
  const id_user = req.id;
  if (!id_tag) {
    return next(createCustomError("ID de tag invalide", 400));
  }

  let sql = `
    INSERT INTO posseder (id, id_tag) 
    SELECT ?, ? 
    FROM formation 
    WHERE id = ? AND id_user = ?
  `;
  const [rows] = await db.query(sql, [id_formation, id_tag, id_formation, id_user]);

  if (!rows.affectedRows) {
    return next(createCustomError("Utilisateur non autorisé ou formation non trouvée ou tag déjà possédé ou tag non existant", 401));
  }

  return res.status(201).json({ message: "Tag ajouté" });
});

export const removeTag = tryCatchWrapper(async function (req, res, next) {
  const id_formation = req.params.id;
  const id_tag = req.body.id_tag;
  const id_user = req.id;

  if (!id_tag) {
    return next(createCustomError("ID de tag invalide", 400));
  }

  let sql = `
    DELETE FROM posseder
    WHERE id = ?
      AND id_tag = ?
      AND id IN (
        SELECT id
        FROM formation
        WHERE id = ?
          AND id_user = ?
      )
  `;
  const [rows] = await db.query(sql, [id_formation, id_tag, id_formation, id_user]);

  if (!rows.affectedRows) {
    return next(createCustomError("Utilisateur non autorisé ou formation non trouvée ou le tag n'existe pas dans cette formation", 401));
  }

  return res.status(200).json({ message: "Tag supprimé de la formation" });
});

export const generate = tryCatchWrapper(async function (req, res, next) {
  const formationTitle = req.body.formationTitle;
  const pageTitle = req.body.pageTitle;

  if (!formationTitle || !pageTitle) {
    return next(createCustomError("Données invalides", 400));
  }

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "Tu es un expert en création de formations sur tout les sujets. Rédige les formations en Markdown, écrit en faisant un titre Markdown de niveau 1 puis des titres Markdown de niveau 2.",
      },
      {
        role: "user",
        content: `Rédige le chapitre "${pageTitle}" très long et détaillée d'une formation sur le sujet "${formationTitle}" en français. Tu peux inclure des blocs de code en spécifiant le langage utilisé :\n\`\`\`langage \na = 1\n\`\`\`\nPour intégrer du code LaTeX, encadre simplement l'expression entre des symboles $, sans utiliser de blocs de code, par exemple : $f(x) = x$ ou $x$. Tu peux illustrer la formation avec des graph fait avec Mermaid, par exemple : \n\`\`\`mermaid\nflowchart TD\n    A[Start] --> B{Is it?}\n    B -->|Yes| C[OK]\n    C --> D[Rethink]\n    D --> B\n    B ---->|No| E[End]\n\`\`\`\nTu peux écrire des emojis dans la formation en utilisant emoji-toolkit, par exemple :heart:\n Ne met pas de = ou - sous les titres.`,
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
    return next(createCustomError("Erreur lors de la génération", 500));
  }
  return res.status(200).json(message);
});

export const putContenu = tryCatchWrapper(async function (req, res, next) {
  const id = req.params.id;
  const contenus = req.body;
  if (!contenus || !Array.isArray(contenus)) {
    return next(createCustomError("Body invalide", 400));
  }

  let sql = "DELETE FROM section WHERE id_formation = ?";
  await db.query(sql, [id]);

  const values = contenus.map(({ nom, contenu }, index) => [
    nom,
    JSON.stringify(contenu),
    index,
    id,
  ]);

  sql = "INSERT INTO section (nom, contenu, ordre, id_formation) VALUES ?";
  await db.query(sql, [values]);

  return res.status(201).json({ message: "Contenu ajouté" });
});

export const putBlock = tryCatchWrapper(async function (req, res, next) {
  const id_formation = req.params.id_formation;
  const id_page = req.params.id_page;
  let contenu = req.body.contenu;
  contenu = JSON.stringify(contenu);

  if (isNaN(id_formation) || isNaN(id_page)) {
    return next(createCustomError("ID invalide", 400));
  }

  let sql = `
    UPDATE section
    SET contenu = ?
    WHERE id_formation = ? AND id = ?
  `;
  await db.query(sql, [contenu, id_formation, id_page]);

  return res.status(200).json({ message: "Bloc modifié" });
});

export const getContenu = tryCatchWrapper(async function (req, res, next) {
  const id = req.params.id;

  const [rows] = await db.query(findByIdQuery, [id]);

  if (!rows.length) {
    return next(createCustomError("Formation non trouvée", 204));
  }

  const data = rows[0];
  let sql = `
    SELECT id, nom, contenu, ordre, id_formation
    FROM section
    WHERE id_formation = ?
    ORDER BY ordre
  `;
  const [rowsSections] = await db.query(sql, [id]);

  data.body = rowsSections.map(({ id, nom, contenu }) => ({
    id,
    nom,
    contenu
  }));
  return res.status(200).json(data);
});

export const getFormationByUser = tryCatchWrapper(async function (req, res, next) {
  const id_user = req.id;

  let sql = `
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
  `;
  const [rows] = await db.query(sql, [id_user]);

  if (!rows.length) {
    return next(createCustomError("Formation non trouvée", 204));
  }
  return res.status(200).json(rows[0]);
});

export const getFormationByContributor = tryCatchWrapper(async function (req, res, next) {
  const id_user = req.id;

  let sql = `
    SELECT formation.id, titre, formation.description, date_creation,
      JSON_OBJECT('id', user.id, 'nom', user.nom, 'prenom', user.prenom) as user,
      IF(COUNT(tag.id) > 0, 
        JSON_ARRAYAGG(JSON_OBJECT('id', tag.id, 'nom', tag.nom)), JSON_ARRAY()) as tag
        FROM formation
        INNER JOIN moderer ON formation.id = moderer.id_formation
        INNER JOIN user ON formation.id_user = user.id
        LEFT JOIN posseder ON formation.id = posseder.id
        LEFT JOIN tag ON posseder.id_tag = tag.id
        WHERE moderer.id = ?
        GROUP BY formation.id
  `;
  const [rows] = await db.query(sql, [id_user]);

  if (!rows.length) {
    return next(createCustomError("Formation non trouvée", 204));
  }
  return res.status(200).json(rows[0]);
});

export const publish = tryCatchWrapper(async function (req, res, next) {
  const idFormation = req.params.id;
  const publier = req.body.publier;
  if (publier === undefined || isNaN(idFormation)) {
    return next(createCustomError("Données invalides", 400));
  }

  let sql = `
    UPDATE formation
    SET publier = ?
    WHERE id = ?
  `;
  await db.query(sql, [publier, idFormation]);

  const [rows] = await db.query(findByIdQuery, [idFormation]);
  if (!rows.length) {
    return next(createCustomError("Formation non trouvée", 204));
  }
  return res.status(200).json(rows[0]);
});

export const postBlock = tryCatchWrapper(async function (req, res, next) {
  const id_formation = req.params.id_formation;
  const id_page = req.params.id_page;
  const id_bloc = req.params.id_bloc;
  const { text, type } = req.body;

  if (
    !text ||
    !type ||
    isNaN(id_formation) ||
    isNaN(id_page) ||
    isNaN(id_bloc)
  ) {
    return next(createCustomError("Données invalides", 400));
  }

  let sql = `
    SELECT id, nom, contenu
    FROM section
    WHERE id_formation = ? AND id = ?
    ORDER BY ordre
  `;
  const [rows] = await db.query(sql, [id_formation, id_page]);

  if (!rows.length) {
    return next(createCustomError("Page non trouvée", 204));
  }

  const page = rows[0];
  page.contenu = page.contenu.map((bloc) => {
    if (bloc.id == id_bloc) {
      bloc.proposalsContenu = bloc.proposalsContenu || [];
      bloc.proposalsContenu.push({ id: bloc.proposalsContenu.length + 1, text, type });
    }
    return bloc;
  });

  sql = `
    UPDATE section
    SET contenu = ?
    WHERE id_formation = ? AND id = ?
  `;
  await db.query(sql, [JSON.stringify(page.contenu), id_formation, id_page]);

  return res.status(201).json({ message: "Bloc ajouté" });
});

export const deleteProposerBlock = tryCatchWrapper(async function (req, res, next) {
  const { id_formation, id_page, id_bloc, id_proposal } = req.params;

  if (
    isNaN(id_formation) ||
    isNaN(id_page) ||
    isNaN(id_bloc) ||
    isNaN(id_proposal)
  ) {
    return next(createCustomError("ID invalide", 400));
  }

  let sql = `
    SELECT id, nom, contenu
    FROM section
    WHERE id_formation = ? AND id = ?
    ORDER BY ordre
  `;
  const [rows] = await db.query(sql, [id_formation, id_page]);

  if (!rows.length) {
    return next(createCustomError("Page non trouvée", 404));
  }

  const page = rows[0];
  page.contenu = page.contenu.map((bloc) => {
    if (bloc.id == id_bloc) {
      bloc.proposalsContenu = bloc.proposalsContenu || [];
      bloc.proposalsContenu = bloc.proposalsContenu.filter(
        (proposal) => proposal.id != id_proposal
      );
    }
    return bloc;
  });

  sql = `
    UPDATE section
    SET contenu = ?
    WHERE id_formation = ? AND id = ?
  `;
  await db.query(sql, [JSON.stringify(page.contenu), id_formation, id_page]);

  return res.status(200).json({ message: "Proposition supprimée" });
});