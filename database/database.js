const mysql = require("mysql");
require("dotenv").config();

const connection = mysql.createConnection({
  host: process.env.BDD_HOST,
  user: process.env.BDD_USER,
  password: "",
  database: process.env.BDD_NAME,
});

connection.connect((err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données :", err);
    return;
  }
  console.log("Connecté à la base de données MySQL");
});

module.exports = connection;
