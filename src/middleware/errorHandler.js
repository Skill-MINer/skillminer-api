export const handleError = (err, req, res, next) => {
  console.error(err);
  return res.status(500).send({ error: "Erreur interne du serveur" });
};