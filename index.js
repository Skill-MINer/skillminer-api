import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import { auth } from "./middleware/authentication.js";
import { login, resetRequest, resetPassword } from "./services/login.js";
import protectedService from "./services/protected.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerFile = JSON.parse(fs.readFileSync("./swagger/swagger-output.json", "utf-8"));

dotenv.config();

const app = express();
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions), bodyParser.json());

app.post("/login", login);
app.post("/reset-request", resetRequest);
app.post("/reset-password/:token", resetPassword);

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
