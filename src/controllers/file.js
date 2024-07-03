import db from "../database/database.js";
import fs from "fs";
import gravatar from "gravatar";
import { tryCatchWrapper } from "../middleware/tryCatchWrapper.js";


export const uploadUserPhoto = tryCatchWrapper(async function (req, res, next) {
  fs.rename(req.file.path, `${req.file.destination}${req.id}.png`, (err) => {
    if (err) {
      return next(createCustomError("Erreur lors de l'enregistrement du fichier", 500));
    } else {
      return res.status(200).json({ message: "Photo enregistré" });
    }
  });
});

export const sendUserPhoto = tryCatchWrapper(async function (req, res, next) {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return next(createCustomError("Mauvais format de l'identifiant", 400));
  }

  res.sendFile(`public/users/${id}.png`, { root: "." }, async (err) => {
    if (err) {
      let sql = "SELECT email FROM user WHERE id = ?";
      const [rows] = await db.query(sql, [id]);

      if (!rows.length) {
        return next(createCustomError("Utilisateur non trouvé", 204));
      }
      res.redirect(
        307,
        gravatar.url(
          rows[0].email,
          { s: "200", r: "pg", d: "identicon" },
          true
        )
      );
    }
  });
});

export const deleteUserPhoto = tryCatchWrapper(async function (req, res, next) {
  const id = req.id;

  fs.unlink(`public/users/${id}.png`, (err) => {
    if (err) {
      return next(createCustomError("Erreur lors de la suppression de la photo", 500));
    } else {
      return res.status(200).json({ message: "Photo supprimée" });
    }
  });
});

export const uploadFormationPhoto = tryCatchWrapper(async function (req, res, next) {
  const { id } = req.params;
  const id_user = req.id;

  if (isNaN(id)) {
    deletePhoto(req.file.path);
    return next(createCustomError("Mauvais format de l'identifiant", 400));
  }

  let sql = "SELECT id_user FROM formation WHERE id = ? AND id_user = ?";
  const [rows] = await db.query(sql, [id, id_user]);

  if (!rows.length) {
    deletePhoto(req.file.path);
    return next(createCustomError("Utilisateur non autorisé ou formation non trouvée", 401));
  }

  fs.rename(req.file.path, `${req.file.destination}${id}.png`, (err) => {
    if (err) {
      deletePhoto(req.file.path);
      return next(createCustomError("Erreur lors de l'enregistrement du fichier", 500));
    } else {
      return res.status(200).json({ message: "Photo enregistré" });
    }
  });
});

export const sendDefaultFormationPhoto = tryCatchWrapper(async function (req, res, next) {
  res.sendFile("public/formations/default.png", { root: "." });
});
