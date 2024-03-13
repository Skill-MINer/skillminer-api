const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require('dotenv').config();

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

exports.resetRequest = (req, res) => {
  const email = req.body.email;

  // Génération d'un token pour la réinitialisation du mot de passe
  const token = jwt.sign({ email: email }, secretKey, {
    expiresIn: tokenExpirationTimeResetPassword,
  });

  // Construction du lien de réinitialisation du mot de passe
  const resetLink = `${urlFront}/reset-password/${token}`;

  // Configuration de l'email
  const mailOptions = {
    from: "votre_adresse_email",
    to: email,
    subject: "Réinitialisation du mot de passe SkillMINer",
    text: `Cliquez sur ce lien pour réinitialiser votre mot de passe : ${resetLink}`,
  };

  // Envoi de l'email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res
        .status(500)
        .json({ error: "Erreur lors de l'envoi de l'email." });
    }
    res.status(200).json({ message: "Email envoyé avec succès." });
  });
};

exports.resetPassword = (req, res) => {
  const token = req.params.token;
  const newPassword = req.body.newPassword;

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token invalide." });
    }
    res.status(200).json({ message: "Mot de passe réinitialisé avec succès." });
  });
};

exports.login = (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const id = `id_${email}`;

  if (!id || !password) {
    return res
      .status(400)
      .json({ error: "Nom d'utilisateur ou mot de passe manquant." });
  }

  const token = jwt.sign({ id: id }, secretKey, {
    expiresIn: tokenExpirationTime,
  });
  res.json({ token: token });
};
