import swaggerAutogen from "swagger-autogen";
import dotenv from "dotenv";

dotenv.config();

const hostname = (new URL(process.env.URL_BACK)).hostname;

const doc = {
  info: {
    title: "SkillMINer",
    description: "API de SkillMINer",
  },
  host: `${hostname}:${process.env.PORT}`,
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
