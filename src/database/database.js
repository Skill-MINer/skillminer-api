import mysql from 'mysql2';
import dotenv from "dotenv";

dotenv.config();

const connection = mysql.createConnection({
  host: process.env.BDD_HOST,
  user: process.env.BDD_USER,
  password: process.env.BDD_PASSWORD,
  database: process.env.BDD_NAME,
});

connection.config.namedPlaceholders = true;

connection.connect((err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données :", err);
    return;
  }
  console.log("Connecté à la base de données MySQL");
});

export default connection;
 