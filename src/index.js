import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import multer from "multer";
import http from "http";
import https from "https";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import connection from './database/database.js';

import { auth } from "./middleware/authentication.js";
import { limitOffset } from "./middleware/limitOffset.js";
import * as tag from "./services/tag.js";
import * as formation from "./services/formation.js";
import * as login from "./services/login.js";
import * as user from "./services/user.js";


dotenv.config();

const secretKey = process.env.SECRET_KEY;

const swaggerFile = JSON.parse(
  fs.readFileSync("./src/swagger/swagger-output.json", "utf-8")
);
const URL_BACK = `${process.env.URL_BACK}:${process.env.PORT}`;
const PORT = process.env.PORT;

const app = express();

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};
const uploadUser = multer({ dest: "public/users/" });
const uploadFormation = multer({ dest: "public/formations/" });

app.use(cors(corsOptions), bodyParser.json());
app.get("/", (req, res) => {
  res.send(`API de SkillMINER, documentation ${URL_BACK}/swagger`);
});

app.post("/login", login.login);
app.post("/reset-request", login.resetRequest);
app.post("/reset-password", login.resetPassword);
app.get("/token-info", auth, login.tokenInfo);

app.get("/users", auth, limitOffset, user.findAll);
app.get("/users/formations", auth, formation.findByUser);
app.get("/users/:id", auth, user.findById);
app.post("/users", user.add);
app.put("/users/password", auth, user.updatePassword);
app.patch("/users", auth, user.update);
app.delete("/users", auth, user.deleteWithToken);

app.get("/formations/:id", formation.findById);
app.get("/formations", limitOffset, formation.findAll);
app.post("/formations", auth, formation.add);
app.post("/formations/:id/contributors", auth, formation.addContributors);
app.get("/formations/:id/contributors", formation.getContributors);
app.put("/formations/:id/header", auth, formation.addHeader);
app.put("/formations/:id/contenu", auth, formation.addContenu);
app.get("/formations/:id/contenu", formation.getContenu);
app.post("/formations/generate", auth, formation.generate);
app.patch("/formations/:id", auth, formation.update);
app.delete("/formations/:id", auth, formation.deleteFormation);
app.post("/formations/:id/tags", auth, formation.addTags);
app.delete("/formations/:id/tags", auth, formation.removeTag);

app.get("/tags", auth, tag.findAll);
app.post("/tags", auth, tag.add);

app.post("/file/users", auth, uploadUser.single("file"), user.uploadPhoto);
app.post("/file/formations/:id", auth, uploadFormation.single("file"), formation.uploadPhoto);
app.get("/file/users/:id", user.sendPhoto);
app.delete("/file/users", auth, user.deletePhoto);
app.use("/file/formations", express.static("public/formations"), formation.sendDefaultPhoto);

app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerFile));
app.use((req, res) => res.status(404).send({ error: "Page non trouvée" }));

let server;
if (process.env.ENVIRONMENT === "production") {
  const ssl_certificate_key = fs.readFileSync(process.env.SSL_KEY, "utf8");
  const ssl_certificate = fs.readFileSync(process.env.SSL_CERT, "utf8");
  const credentials = { key: ssl_certificate_key, cert: ssl_certificate };
  server = https.createServer(credentials, app);
  server.listen(PORT, () => {
    console.log(
      `Serveur en cours d'exécution sur le port ${PORT}, documentation ${URL_BACK}/swagger with prod`
    );
  });
} else {
  server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(
      `Serveur en cours d'exécution sur le port ${PORT}, documentation ${URL_BACK}/swagger with dev`
    );
  });
}

const io = new Server(server, { cors: { origin: "*" } });

// io.use((socket, next) => {
  
// });

io.on("connection", (socket) => {
  let m_room_id = "";
  let m_user_id = "";
  let m_user_name = "";

  console.log("a user connected");

  socket.on("connection-to-room", ({token, room_id}) => {
    if (!token) {
      return new Error("Accès non autorisé. Token manquant.");
    }
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        return new Error("Accès non autorisé. Token invalide.");
      }
      m_user_id = decoded.id;
    });
    connection.query(`
    SELECT id, nom, prenom, email, description, date_inscription 
    FROM user WHERE id = ?`,
    [m_user_id], (err, results) => {
      if (err) {
        throw new Error(err.message);
      } else if (results.length === 0) {
        throw new Error("Utilisateur non trouvé ou non autorisé");
      } else {
        m_user_name = results[0].prenom + " " + results[0].nom;
      }
    });
    m_room_id = room_id;
    socket.join(m_room_id);
  });

  socket.on("cursor", ({ top, left }) => {
    socket.to(m_room_id).emit("cursor", {
       id: m_user_id,
       name: m_user_name,
       top,
       left 
      });
  });

  socket.on("disconnect", () => {
    socket.leave(m_room_id);
    console.log("user disconnected");
  });
});
