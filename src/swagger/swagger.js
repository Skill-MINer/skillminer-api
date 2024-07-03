import swaggerAutogen from "swagger-autogen";
import dotenv from "dotenv";

dotenv.config();

const hostname = (new URL(process.env.URL_BACK)).hostname;
const schemes = process.env.ENVIRONMENT === "dev" ? ['http'] : ['https'];

const doc = {
  info: {
    title: "SkillMINer",
    version: "1.0.0",
    description: "API de SkillMINer",
    // termsOfService: "http://example.com/terms/",
    contact: {
      name: "API Support",
      email: "support@skillminer.fr",
      url: "https://skillminer.com/support"
    },
    license: {
      name: "Apache 2.0",
      url: "http://www.apache.org/licenses/LICENSE-2.0.html"
    }
  },
  host: `${hostname}:${process.env.PORT}`,
  schemes: schemes,
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
swaggerAutogen({openapi: '3.0.0'})(outputFile, routes, doc);
