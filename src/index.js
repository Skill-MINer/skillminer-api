import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import http from "http";
import https from "https";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import connection from "./database/database.js";

import { handleError } from "./middleware/errorHandler.js";
import morganMiddleware from "./middleware/morganMiddleware.js";
import logger from "./scripts/logger.js";
import v1Router from './v1/routes/index.js';

const app = express();
const PORT = process.env.PORT || 3000;
const URL_BACK = process.env.URL_BACK || 'http://localhost'

const swaggerFile = JSON.parse(
  fs.readFileSync("./src/swagger/swagger-output.json", "utf-8")
);

const corsOptions = {
  origin: ["http://localhost:4200", "https://skillminer-front.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions), bodyParser.json());
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerFile));
app.use("/api/v1", v1Router); // app.use("/api/v1", v1Router);
app.use(morganMiddleware, handleError);
app.use((req, res) => res.status(404).send({ error: "Page non trouvée !" }));

let server;
if (process.env.ENVIRONMENT === "production") {
  const ssl_certificate_key = fs.readFileSync(process.env.SSL_KEY, "utf8");
  const ssl_certificate = fs.readFileSync(process.env.SSL_CERT, "utf8");
  const credentials = { key: ssl_certificate_key, cert: ssl_certificate };
  server = https.createServer(credentials, app);
  server.listen(PORT, () => {
    logger.info(
      `Serveur en cours d'exécution sur le port ${PORT}, documentation ${URL_BACK}/swagger with prod`
    );
  });
} else {
  server = http.createServer(app);
  server.listen(PORT, () => {
    logger.info(
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
      connection.query(
        `
    SELECT id, prenom
    FROM user WHERE id = ?`,
        [m_user_id],
        (err, results) => {
          if (err) {
            throw new Error(err.message);
          } else if (results.length === 0) {
            throw new Error("Utilisateur non trouvé ou non autorisé");
          } else {
            m_user_name = results[0].prenom;
          }
        }
      );
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
        left,
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

    socket.on("deleteBlock", (data) => {
      socket.to(m_room_id).emit("deleteBlock", data);
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
