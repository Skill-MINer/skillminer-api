import swaggerAutogen from "swagger-autogen";
import dotenv from "dotenv";

dotenv.config();

const doc = {
  info: {
    title: "SkillMINer",
    description: "API de SkillMINer",
  },
  host: `localhost:${process.env.PORT}`,
  securityDefinitions: {
    apiKeyAuth: {
      type: "apiKey",
      in: "header",
      name: "authorization",
      description: "Token utilisateur",
    },
  }
};

const outputFile = "./swagger-output.json";
const routes = ["../index.js"];
swaggerAutogen()(outputFile, routes, doc);
