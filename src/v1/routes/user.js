import { Router } from "express";
import { limitOffset } from "../../middleware/limitOffset.js";


import { auth } from "../../middleware/authentication.js";
import * as user from '../../controllers/user.js'

const router = Router();


router.post("/login", user.login);
router.get("/", auth, limitOffset, user.getUsers); // non utilisé
router.post("/", user.addUser);
router.patch("/", auth, user.updateUser);
router.delete("/", auth, user.deleteUserWithToken);
router.put("/password", auth, user.updatePassword);
router.post("/reset-request", user.resetRequest);
router.post("/reset-password", user.resetPassword);
router.get("/token-info", auth, user.getTokenInfo);

router.get("/:id", auth, user.getUserById); // à mettre à la fin des get ;)
export default router;