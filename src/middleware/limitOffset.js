export const limitOffset = (req, res, next) => {
  req.query.limit = parseInt(req.query.limit);
  req.query.offset = parseInt(req.query.offset);
  const limit =
    req.query.limit < 50 && req.query.limit > 0 ? req.query.limit : 10;
  const offset = req.query.offset > 0 ? req.query.offset : 0;

  if (isNaN(limit) || isNaN(offset)) {
    return res
      .status(400)
      .json({ error: "Mauvais format de la limite ou du décalage" });
  }
  req.limit = limit;
  req.offset = offset;
  next();
};
