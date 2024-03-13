const swaggerAutogen = require("swagger-autogen")();
require('dotenv').config();

const doc = {
  info: {
    title: "SkillMINer",
    description: "API de SkillMINer",
  },
  host: `localhost:${process.env.PORT}`,
};

const outputFile = "./swagger-output.json";
const routes = ["../index.js"];
swaggerAutogen(outputFile, routes, doc);
