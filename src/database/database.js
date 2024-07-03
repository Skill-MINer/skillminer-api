import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
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

// Testing the initial connection
pool.query('SELECT 1 + 1 AS solution', (error, results, fields) => {
  if (error) {
    console.error('Database connection failed:', error.message);
  } else {
    console.log('Connected to MySQL database!');
  }
});

// Handling connection errors explicitly
pool.on('error', (err) => {
  console.error('MySQL Pool Error:', err.message);
});

export default pool.promise();
