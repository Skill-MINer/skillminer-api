import connection from '../database/database.js';
import bcrypt from 'bcrypt';
import { verifyEmail, verifyPassword } from '../scripts/verification.js';
import { createToken } from '../scripts/createToken.js';
import fs from 'fs';


export const findAll = (req, res) => {
  req.query.limit = parseInt(req.query.limit);
  req.query.offset = parseInt(req.query.offset);
  const limit = req.query.limit < 50 && req.query.limit > 0 ? req.query.limit : 10;
  const offset = req.query.offset > 0 ? req.query.offset : 0;

  if (isNaN(limit) || isNaN(offset)) {
    return res.status(400).json({ error: "Mauvais format de la limite ou du décalage" });
  }

  connection.query('SELECT id, nom, prenom, email, date_inscription FROM user LIMIT ? OFFSET ?', [limit, offset], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (results.length === 0) {
      res.status(404).json({ error: "Utilisateur non trouvé" });
    } else {
      res.status(200).json(results);
    }
  });
};

export const findById = (req, res) => {
  const id = req.params.id;
  if (isNaN(id)) {
    return res.status(400).json({ error: "Mauvais format de l'identifiant" });
  }

  connection.query(`
  SELECT id, nom, prenom, email, date_inscription 
  FROM user WHERE id = ?`,
  [id], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (results.length === 0) {
      res.status(404).json({ error: "Utilisateur non trouvé" });
    } else {
      res.status(200).json(results[0]);
    }
  });
};

export const add = async (req, res) => {
  const { nom, prenom, email, password } = req.body;
  if (!nom || !prenom || !email || !password) {
    return res.status(400).json({ error: "Body invalide" });
  }
  if (!verifyEmail(email) || !verifyPassword(password)) {
    return res.status(400).json({ error: "Email invalide ou mot de passe invalide" });
  }

  const hashPassword = await bcrypt.hash(password, 10);
  const dateInscription = new Date();

  connection.query(`
  INSERT INTO user (nom, prenom, email, password, date_inscription, permission) 
  VALUES (?, ?, ?, ?, ?, ?)`, [ nom, prenom, email, hashPassword, dateInscription, 0 ], 
  (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const id = results.insertId;
      res.status(200).json({ id: id, token: createToken(id) });
    }
  });
}

export const update = (req, res) => {
  const id = req.id;
  const { nom, prenom, email } = req.body;
  if (!nom && !prenom && (!email || !verifyEmail(email))) {
    return res.status(400).json({ error: "Body invalide" });
  }
  const emailVerify = verifyEmail(email) ? email : null;  

  connection.query(`
  UPDATE user
  SET 
      nom = CASE WHEN :nom <> nom AND :nom IS NOT NULL 
            THEN :nom ELSE nom END,
      prenom = CASE WHEN :prenom <> prenom AND :prenom IS NOT NULL 
               THEN :prenom ELSE prenom END,
      email = CASE WHEN :email <> email AND :email IS NOT NULL 
              THEN :email ELSE email END
  WHERE id = :id`, 
  { id, nom, prenom, email: emailVerify}, 
  (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (results.affectedRows === 0) {
      res.status(404).json({ error: "Utilisateur non trouvé" });
    } else {
      res.status(200).json({ message: results.info });
    }
  });
}

export const deleteWithToken = (req, res) => {
  const id = req.id;
  connection.query('DELETE FROM user WHERE id = ?', [id], (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (results.affectedRows === 0) {
      res.status(404).json({ error: "Utilisateur non trouvé" });
    } else {
      res.status(200).json({ message: "Utilisateur supprimé" });
    }
  });
}

export const uploadPhoto = (req, res) => {
  fs.rename(req.file.path, `${req.file.destination}${req.id}.png`, (err) => {
    if (err) {
      return res.status(500).send("Erreur lors de l'enregistrement du fichier");
    } else {
      return res.status(200).json({ message: 'Photo enregistré' });
    }
  });
}
