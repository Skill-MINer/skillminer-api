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

import { auth, verifUserFormation } from "./middleware/authentication.js";
import { limitOffset } from "./middleware/limitOffset.js";
import { handleError } from "./middleware/errorHandler.js";
import { logger } from "./middleware/logger.js";
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

app.use(cors(corsOptions), bodyParser.json(), logger);

app.get("/", (req, res) => {
  res.send(`API de SkillMINER, documentation ${URL_BACK}/swagger`);
});

app.post("/login", login.login);
app.post("/reset-request", login.resetRequest);
app.post("/reset-password", login.resetPassword);
app.get("/token-info", auth, login.tokenInfo);

app.get("/users", auth, limitOffset, user.findAll); // non utilisé
app.get("/users/formations", auth, formation.findByUser);
app.get("/users/formations/contributors", auth, formation.findByContributor);
app.get("/users/:id", auth, user.findById); // non utilisé
app.post("/users", user.add);
app.put("/users/password", auth, user.updatePassword);
app.patch("/users", auth, user.update);
app.delete("/users", auth, user.deleteWithToken);

app.get("/formations/:id", formation.findById);
app.get("/formations", limitOffset, formation.findAll);
app.post("/formations", auth, formation.add);
app.post("/formations/:id/contributors", auth, formation.addContributors);
app.get("/formations/:id/contributors", formation.getContributors);
app.get("/formations/:id/contributors/token-info", auth, formation.getContributorsByToken);
app.put("/formations/:id/header", auth, verifUserFormation, formation.addHeader);
app.put("/formations/:id/contenu", auth, verifUserFormation, formation.putContenu);
app.get("/formations/:id/contenu", formation.getContenu);
app.put("/formations/:id_formation/contenu/:id_page", auth, verifUserFormation, formation.putBlock);
app.post("/formations/:id_formation/contenu/:id_page/bloc/:id_bloc", auth, formation.postBlock);
app.delete("/formations/:id_formation/contenu/:id_page/bloc/:id_bloc/proposal/:id_proposal", auth, verifUserFormation, formation.deleteProposerBlock);
app.put("/formations/:id/publier", auth, verifUserFormation, formation.publish);
app.post("/formations/generate", auth, formation.generate);
app.get("/formations/:id/editors", auth, formation.getEditors);

app.patch("/formations/:id", auth, formation.update); // non utilisé
app.delete("/formations/:id", auth, formation.deleteFormation); // non utilisé
app.post("/formations/:id/tags", auth, formation.addTags); // non utilisé
app.delete("/formations/:id/tags", auth, formation.removeTag); // non utilisé

app.get("/tags", auth, tag.findAll);
app.post("/tags", auth, tag.add); // non utilisé

app.post("/file/users", auth, uploadUser.single("file"), user.uploadPhoto);
app.post("/file/formations/:id", auth, uploadFormation.single("file"), formation.uploadPhoto);
app.get("/file/users/:id", user.sendPhoto);
app.delete("/file/users", auth, user.deletePhoto);
app.use("/file/formations", express.static("public/formations"), formation.sendDefaultPhoto);

app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerFile));
app.use((req, res) => res.status(404).send({ error: "Page non trouvée !" }));
app.use(handleError);

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


io.on("connection", (socket) => {
  try {
    let m_room_id = "";
    let m_user_id = "";
    let m_user_name = "";

    socket.on("connection-to-room", ({ token, room_id }) => {
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
    SELECT id, prenom
    FROM user WHERE id = ?`,
        [m_user_id], (err, results) => {
          if (err) {
            throw new Error(err.message);
          } else if (results.length === 0) {
            throw new Error("Utilisateur non trouvé ou non autorisé");
          } else {
            m_user_name = results[0].prenom;
          }
        });
      m_room_id = room_id;
      socket.join(m_room_id);
      socket.to(m_room_id).emit("getFormationData");
    });

    socket.on("setFormationData", (data) => {
      socket.to(m_room_id).emit("setFormationData", data);
    });

    socket.on("cursor", ({ top, left }) => {
      socket.to(m_room_id).emit("cursor", {
        id: m_user_id,
        name: m_user_name,
        top,
        left
      });
    });

    socket.on("edit", (data) => {
      socket.to(m_room_id).emit("edit", data);
    });

    socket.on("moveBlock", (data) => {
      socket.to(m_room_id).emit("moveBlock", data);
    });

    socket.on("addBlockMD", (data) => {
      socket.to(m_room_id).emit("addBlockMD", data);
    });

    socket.on("editTitle", (data) => {
      socket.to(m_room_id).emit("editTitle", data);
    });

    socket.on("movePage", (data) => {
      socket.to(m_room_id).emit("movePage", data);
    });

    socket.on("editPageTitle", (data) => {
      socket.to(m_room_id).emit("editPageTitle", data);
    });

    socket.on("addPage", (data) => {
      socket.to(m_room_id).emit("addPage", data);
    });

    socket.on("addBlockVideo", (data) => {
      socket.to(m_room_id).emit("addBlockVideo", data);
    });

    socket.on('deleteBlock', (data) => {
      socket.to(m_room_id).emit('deleteBlock', data);
    });

    socket.on("deletePage", (data) => {
      socket.to(m_room_id).emit("deletePage", data);
    });

    socket.on("disconnect", () => {
      socket.leave(m_room_id);
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
});
