import jwt from 'jsonwebtoken';
import dotenv from "dotenv";

dotenv.config();

const tokenExpirationTime = process.env.TOKEN_EXPIRATION_TIME;
const secretKey = process.env.SECRET_KEY;

export const createToken = (id) => {
  return jwt.sign({ id: id }, secretKey, {
    expiresIn: tokenExpirationTime,
  });
};
