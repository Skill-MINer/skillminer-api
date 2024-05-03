import mysql from 'mysql2';
import dotenv from "dotenv";

dotenv.config();

const connection = mysql.createPool({
  host: process.env.BDD_HOST,
  port: process.env.BBD_PORT,
  user: process.env.BDD_USER,
  password: process.env.BDD_PASSWORD,
  database: process.env.BDD_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true
});

connection.query('SELECT 1 + 1 AS solution', (error, results, fields) => {
  if (error) throw error;
  console.log("Connxion à MySQL réussie !");
});

export default connection;
 