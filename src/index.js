import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import { auth } from "./middleware/authentication.js";
import multer from 'multer';

import * as login from "./services/login.js";
import * as user from "./services/user.js";

const swaggerFile = JSON.parse(fs.readFileSync("./src/swagger/swagger-output.json", "utf-8"));

dotenv.config();

const app = express();
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};
const uploadUser = multer({ dest: 'public/users/' });

app.use(cors(corsOptions), bodyParser.json());
app.post("/login", login.login);
app.post("/reset-request", login.resetRequest);
app.post("/reset-password", login.resetPassword);
app.get("/token-info", auth, login.tokenInfo);

app.get("/users", auth, user.findAll);
app.get("/users/:id", auth, user.findById);
app.post("/users", user.add);
app.patch("/users", auth, user.update);
app.delete("/users", auth, user.deleteWithToken);

app.post("/file/users", auth, uploadUser.single('file'), user.uploadPhoto);
app.use('/file', auth, express.static('public'));

app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerFile));
app.use("/", (req, res) => {
  res.send("API de SkillMINER, documentation /swagger");
});

const port = process.env.PORT;
app.listen(port, () => {
  console.log(
    `Serveur en cours d'exécution sur le port ${port}, documentation : /swagger`,
  );
});
