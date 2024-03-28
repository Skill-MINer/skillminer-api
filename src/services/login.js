import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import connection from '../database/database.js';
import { createToken } from '../scripts/createToken.js';

dotenv.config();

const secretKeyReset = process.env.SECRET_KEY_RESET;
const tokenExpirationTimeResetPassword = "10m";
const urlFront = process.env.URL_FRONT;
const fromEmail = process.env.EMAIL;
const tokenExpirationTime = process.env.TOKEN_EXPIRATION_TIME;
const expiresIn = parseInt(tokenExpirationTime)*60*60;

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

export const resetRequest = (req, res) => {
  const email = req.body.email;
  if (!email) {
    return res.status(400).json({ error: "Email manquant." });
  }

  connection.query(
    "SELECT id, email FROM user WHERE email = ?",
    [email],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.length === 0) {
        return res.status(401).json({ error: "Utilisateur non trouvé." });
      }

      const token = jwt.sign(
        { id: results[0].id, email: results[0].email },
        secretKeyReset,
        {
          expiresIn: tokenExpirationTimeResetPassword,
        }
      );

      const resetLink = `${urlFront}/reset-password/${token}`;

      const mailOptions = {
        from: fromEmail,
        to: email,
        subject: "Réinitialisation du mot de passe SkillMINer",
        text: `Cliquez sur ce lien pour réinitialiser votre mot de passe : ${resetLink}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return res
            .status(500)
            .json({ error: "Erreur lors de l'envoi de l'email." });
        }
        res.status(200).json({ message: "Email envoyé avec succès." });
      });
    }
  );
};

export const resetPassword = async (req, res) => {
  const token = req.body.token;
  const password = req.body.password;

  if (!token || !password) {
    return res
      .status(400)
      .json({ error: "Token ou mot de passe manquant." });
  }

  jwt.verify(token, secretKeyReset, async (err, data) => {
    if (err) {
      return res.status(403).json({ error: "Token invalide." });
    }

    const id = data.id;
    const hashPassword = await bcrypt.hash(password, 10);

    connection.query(
      "UPDATE user SET password = ? WHERE id = ?",
      [hashPassword, id],
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.status(200).json({ message: "Mot de passe modifié avec succès." });
      }
    );
  });
};

export const login = async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Nom d'utilisateur ou mot de passe manquant." });
  }

  connection.query(
    "SELECT id, password, nom, prenom, email FROM user WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.length === 0) {
        return res.status(401).json({ error: "Utilisateur non trouvé." });
      }

      const hashPassword = results[0].password;
      const {id, nom, prenom, email} = results[0];
      const result = await bcrypt.compare(password, hashPassword);
      if (!result) {
        return res.status(401).json({ error: "Mot de passe incorrect." });
      }

      res.json({ token: createToken(id), expiresIn, id, nom, prenom, email });
    }
  );
};

export const tokenInfo = async (req, res) => {
  const id = req.id;
  connection.query(
    "SELECT id, nom, prenom, email, date_inscription FROM user WHERE id = ?",
    [id],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: "Utilisateur non trouvé." });
      }
      res.json(results[0]);
    }
  );
};
