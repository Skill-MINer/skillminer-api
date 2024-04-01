import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import multer from "multer";

import { auth } from "./middleware/authentication.js";
import { limitOffset } from "./middleware/limitOffset.js";
import * as tag from "./services/tag.js";
import * as formation from "./services/formation.js";
import * as login from "./services/login.js";
import * as user from "./services/user.js";

const swaggerFile = JSON.parse(
  fs.readFileSync("./src/swagger/swagger-output.json", "utf-8")
);
const URL_BACK = `${process.env.URL_BACK}:${process.env.PORT}`;
const PORT = process.env.PORT;

dotenv.config();

const app = express();
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};
const uploadUser = multer({ dest: "public/users/" });

app.use(cors(corsOptions), bodyParser.json());
app.get("/", (req, res) => {
  res.send(`API de SkillMINER, documentation ${URL_BACK}/swagger`);
});

app.post("/login", login.login);
app.post("/reset-request", login.resetRequest);
app.post("/reset-password", login.resetPassword);
app.get("/token-info", auth, login.tokenInfo);

app.get("/users", auth, limitOffset, user.findAll);
app.get("/users/:id", auth, user.findById);
app.post("/users", user.add);
app.put("/users/password", auth, user.updatePassword);
app.patch("/users", auth, user.update);
app.delete("/users", auth, user.deleteWithToken);

app.get("/formations/:id", formation.findById);
app.get("/formations", limitOffset, formation.findAll);
app.post("/formations", auth, formation.add);
app.patch("/formations/:id", auth, formation.update);
app.delete("/formations/:id", auth, formation.deleteFormation);
app.post("/formations/:id/tags", auth, formation.addTags);
app.delete("/formations/:id/tags", auth, formation.removeTag);

app.get("/tags", limitOffset, tag.findAll);
app.post("/tags", auth, tag.add);

app.post("/file/users", auth, uploadUser.single("file"), user.uploadPhoto);
app.use("/file", express.static("public"));

app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerFile));
app.use((req, res) => res.status(404).send({ error: "Page non trouvée" }));

app.listen(PORT, () => {
  console.log(
    `Serveur en cours d'exécution sur le port ${PORT}, documentation ${URL_BACK}/swagger`
  );
});
