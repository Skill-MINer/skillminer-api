import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const secretKey = process.env.SECRET_KEY;
const tokenExpirationTimeResetPassword = "10m";
const tokenExpirationTime = "1h";
const urlFront = process.env.URL_FRONT;

const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

export const resetRequest = (req, res) => {
  const { email } = req.body;

  // Génération d'un token pour la réinitialisation du mot de passe
  const token = jwt.sign({ email }, secretKey, {
    expiresIn: tokenExpirationTimeResetPassword,
  });

  // Construction du lien de réinitialisation du mot de passe
  const resetLink = `${urlFront}/reset-password/${token}`;

  // Configuration de l'email
  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Réinitialisation du mot de passe",
    text: `Cliquez sur le lien suivant pour réinitialiser votre mot de passe: ${resetLink}`,
  };

  // Envoi de l'email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res
        .status(500)
        .json({ error: "Une erreur est survenue lors de l'envoi de l'email." });
    } else {
      console.log(`Email sent: ${info.response}`);
      res.status(200).json({ message: "Email de réinitialisation envoyé." });
    }
  });
};

export const resetPassword = (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  jwt.verify(token, secretKey, (err) => {
    if (err) {
      return res.status(403).json({ error: "Token invalide." });
    }
    res.status(200).json({ message: "Mot de passe réinitialisé avec succès." });
  });
};

export const login = (req, res) => {
  const { email, password } = req.body;
  const id = `id_${email}`;

  if (!id || !password) {
    return res
      .status(400)
      .json({ error: "Nom d'utilisateur ou mot de passe manquant." });
  }

  const token = jwt.sign({ id }, secretKey, {
    expiresIn: tokenExpirationTime,
  });
  return res.json({ token });
};
