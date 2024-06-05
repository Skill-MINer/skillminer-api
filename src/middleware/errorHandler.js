export const handleError = (err, req, res, next) => {
  if (req.headers["connection"] === "keep-alive") {
    return;
  }
  console.log(err);
  res.status(500).send({ error: "Erreur interne du serveur" });
};