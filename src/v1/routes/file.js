import express, { Router } from "express";
import multer from "multer";


import { auth } from "../../middleware/authentication.js";
import * as file from '../../controllers/file.js';

const router = Router();
const uploadUser = multer({ dest: "public/users/" });
const uploadFormation = multer({ dest: "public/formations/" });

router.get("/users/:id", file.sendUserPhoto);
router.post("/users", auth, uploadUser.single("file"), file.uploadUserPhoto);
router.delete("/users", auth, file.deleteUserPhoto);
router.post(
  "/formations/:id",
  auth,
  uploadFormation.single("file"),
  file.uploadFormationPhoto
);
router.get(
  "/formations",
  express.static("public/formations"),
  file.sendDefaultFormationPhoto
);

export default router;