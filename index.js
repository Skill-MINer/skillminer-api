import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import { auth } from "./middleware/authentication.js";

import * as login from "./services/login.js";
import { protectedService } from "./services/protected.js";
import * as user from "./services/user.js";

const swaggerFile = JSON.parse(fs.readFileSync("./swagger/swagger-output.json", "utf-8"));

dotenv.config();

const app = express();
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions), bodyParser.json());

app.post("/login", login.login);
app.post("/reset-request", login.resetRequest);
app.post("/reset-password/:token", login.resetPassword);

app.get("/users", auth, user.findAll);
app.get("/users/:id", auth, user.findById);
app.post("/users", user.add);

app.get("/protected", auth, protectedService);

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
