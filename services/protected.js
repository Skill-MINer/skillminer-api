export const protectedService = (req, res) => {
  res.json({ message: "Ressource protégée accessible", id: req.id });
};
