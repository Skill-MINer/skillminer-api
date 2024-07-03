import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import db from "../database/database.js";
import { verifyEmail, verifyPassword } from "../scripts/verification.js";
import { createToken } from "../scripts/createToken.js";
import { tryCatchWrapper } from "../middleware/tryCatchWrapper.js";
import { createCustomError } from "../scripts/customError.js";

dotenv.config();

const secretKeyReset = process.env.SECRET_KEY_RESET;
const tokenExpirationTimeResetPassword = "10m";
const urlFront = process.env.URL_FRONT;
const fromEmail = process.env.EMAIL;
const tokenExpirationTime = process.env.TOKEN_EXPIRATION_TIME;
const expiresIn = parseInt(tokenExpirationTime) * 60 * 60;

const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: fromEmail,
    pass: process.env.PASSWORD,
  },
});

export const resetRequest = tryCatchWrapper(async function (req, res, next) {
  const { email } = req.body;

  if (!email) {
    return next(createCustomError("Email manquant.", 400));
  }

  let sql = "SELECT id, email FROM user WHERE email = ?";
  const [rows] = await db.query(sql, [email]);

  if (!rows.length) {
    return next(createCustomError("Utilisateur non trouvé.", 204));
  }

  const token = jwt.sign(
    { id: rows[0].id, email: rows[0].email },
    secretKeyReset,
    { expiresIn: tokenExpirationTimeResetPassword }
  );

  const resetLink = `${urlFront}/users/reset-password/${token}`;

  const mailOptions = {
    from: fromEmail,
    to: email,
    subject: "Réinitialisation du mot de passe SkillMINer",
    text: `Cliquez sur ce lien pour réinitialiser votre mot de passe : ${resetLink}`,
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      return next(createCustomError("Erreur lors de l'envoi de l'email.", 500));
    } else {
      return res.status(200).json({ message: "Email envoyé avec succès." });
    }
  });
});

export const resetPassword = tryCatchWrapper(async function (req, res, next) {
  const token = req.body.token;
  const password = req.body.password;

  if (!token || !password) {
    return next(createCustomError("Token ou mot de passe manquant.", 400));
  }

  jwt.verify(token, secretKeyReset, async (err, data) => {
    if (err) {
      return next(createCustomError("Token invalide.", 403));
    }

    const id = data.id;
    const hashPassword = await bcrypt.hash(password, 10);

    let sql = "UPDATE user SET password = ? WHERE id = ?";
    await db.query(sql, [hashPassword, id]);

    return res.status(200).json({ message: "Mot de passe modifié avec succès." });
  });
});

export const login = tryCatchWrapper(async function (req, res, next) {
  const email = req.body.email;
  const password = req.body.password;
  if (!email || !password) {
    return next(createCustomError("Nom d'utilisateur ou mot de passe manquant.", 400));
  }

  let sql = "SELECT id, password, nom, prenom, email FROM user WHERE email = ?";
  const [rows] = await db.query(sql, [email]);

  if (!rows.length) {
    return next(createCustomError("Utilisateur non trouvé.", 204));
  }

  const {
    id,
    password: hashPassword,
    nom,
    prenom,
    email: userEmail,
  } = rows[0];
  const isValidPassword = await bcrypt.compare(password, hashPassword);
  if (!isValidPassword) {
    return next(createCustomError("Mot de passe incorrect.", 401));
  }

  return res.status(200).json({
    token: createToken(id),
    expiresIn,
    id,
    nom,
    prenom,
    email: userEmail,
  });
});

export const getTokenInfo = tryCatchWrapper(async function (req, res, next) {
  const id = req.id;
  let sql = "SELECT id, nom, prenom, email, description, date_inscription FROM user WHERE id = ?";
  const [rows] = await db.query(sql, [id]);

  if (!rows.length) {
    return next(createCustomError("Utilisateur non trouvé.", 204));
  }
  return res.status(200).json(rows[0]);
});

export const getUsers = tryCatchWrapper(async function (req, res, next) {
  const limit = req.limit;
  const offset = req.offset;

  let sql = "SELECT id, nom, prenom, email, description, date_inscription FROM user LIMIT ? OFFSET ?";
  const [rows] = await db.query(sql, [limit, offset]);

  if (!rows.length) {
    return next(createCustomError("Utilisateurs non trouvés.", 204));
  }
  return res.status(200).json(rows[0]);
});

export const getUserById = tryCatchWrapper(async function (req, res, next) {
  const { id } = req.params;
  if (isNaN(id)) {
    return next(createCustomError("Mauvais format de l'identifiant.", 400));
  }

  let sql = "SELECT id, nom, prenom, email, description, date_inscription FROM user WHERE id = ?";
  const [rows] = await db.query(sql, [id]);

  if (!rows.length) {
    return next(createCustomError("Utilisateur non trouvé.", 204));
  }
  return res.status(200).json(rows[0]);
});

export const addUser = tryCatchWrapper(async function (req, res, next) {
  const { nom, prenom, email, password } = req.body;
  if (!nom || !prenom || !email || !password) {
    return next(createCustomError("Corps de la requête invalide.", 400));
  }
  if (!verifyEmail(email) || !verifyPassword(password)) {
    return next(createCustomError("Email ou mot de passe invalide.", 400));
  }

  const hashPassword = await bcrypt.hash(password, 10);
  const dateInscription = new Date();

  let sql = "INSERT INTO user (nom, prenom, email, password, description, date_inscription, permission) VALUES (?, ?, ?, ?, ?, ?, ?)";
  const [rows] = await db.query(sql, [nom, prenom, email, hashPassword, "", dateInscription, 0]);
  const id = rows[0].insertId;
  const token = createToken(id);

  return res.status(201).json({ id, token, expiresIn });
});

export const updateUser = tryCatchWrapper(async function (req, res, next) {
  const id = req.id;
  const { nom, prenom, email, description } = req.body;

  if (!nom && !prenom && (!email || !verifyEmail(email)) && !description) {
    return next(createCustomError("Corps de la requête invalide.", 400));
  }

  const emailVerify = verifyEmail(email) ? email : null;
  let sql = `UPDATE user
              SET nom = CASE WHEN ? <> nom AND ? IS NOT NULL THEN ? ELSE nom END,
                  prenom = CASE WHEN ? <> prenom AND ? IS NOT NULL THEN ? ELSE prenom END,
                  email = CASE WHEN ? <> email AND ? IS NOT NULL THEN ? ELSE email END,
                  description = CASE WHEN ? <> description AND ? IS NOT NULL THEN ? ELSE description END
              WHERE id = ?`;
  const [rows] = await db.query(sql, [nom, nom, nom, prenom, prenom, prenom, emailVerify, email, email, description, description, description, id]);

  if (!rows.affectedRows) {
    return next(createCustomError("Utilisateur non trouvé ou non autorisé.", 204));
  }
  return res.status(200).json({ message: "Utilisateur mis à jour." });
});

export const updatePassword = tryCatchWrapper(async function (req, res, next) {
  const id = req.id;
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || !verifyPassword(newPassword)) {
    return next(createCustomError("Mot de passe invalide.", 400));
  }

  let sql = "SELECT password FROM user WHERE id = ?";
  const [rows] = await db.query(sql, [id]);

  if (!rows.length) {
    return next(createCustomError("Utilisateur non trouvé.", 204));
  }
  const hashPassword = rows[0].password;
  const isPasswordValid = await bcrypt.compare(oldPassword, hashPassword);

  if (!isPasswordValid) {
    return next(createCustomError("Mot de passe incorrect.", 400));
  }

  const newHashPassword = await bcrypt.hash(newPassword, 10);
  sql = "UPDATE user SET password = ? WHERE id = ?";
  await db.query(sql, [newHashPassword, id]);

  return res.status(200).json({ message: "Mot de passe modifié." });
});

export const deleteUserWithToken = tryCatchWrapper(async function (req, res, next) {
  const id = req.id;
  if (!id) {
    return next(createCustomError("L'id est nécessaire.", 400));
  }

  let sql = "DELETE FROM user WHERE id = ?";
  const [rows] = await db.query(sql, [id]);

  if (!rows.affectedRows) {
    return next(createCustomError("Utilisateur non trouvé.", 204));
  }
  return res.status(200).json({ message: "Utilisateur supprimé." });
});
