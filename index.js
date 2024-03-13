const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config();
const swaggerUi = require("swagger-ui-express");
const swaggerFile = require("./swagger/swagger-output.json");
const authentication = require("./middleware/authentication");

const login = require("./services/login");
const protected = require("./services/protected.js");

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

app.get("/protected", authentication.auth, protected.protected);

app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerFile));

app.use("/", (req, res) => {
  res.send("API de SkillMINER, documentation /swagger");
});

const port = process.env.PORT;
app.listen(port, () => {
  console.log(
    `Serveur en cours d'exécution sur le port ${port}, documentation : /swagger`
  );
});

