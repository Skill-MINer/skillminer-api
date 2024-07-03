import { Router } from "express";

import { auth, verifUserFormation } from "../../middleware/authentication.js";
import { limitOffset } from "../../middleware/limitOffset.js";
import * as formation from '../../controllers/formation.js'

const router = Router();

router.get("", limitOffset, formation.findAll);
router.post("", auth, formation.add);
router.get("/user", auth, formation.getFormationByUser);
router.get("/contributor", auth, formation.getFormationByContributor);
router.post("/generate", auth, formation.generate);
router.get("/:id", formation.findById);
router.patch("/:id", auth, formation.update); // non utilisé
router.delete("/:id", auth, formation.deleteFormation); // non utilisé
router.post("/:id/tags", auth, formation.addTags); // non utilisé
router.delete("/:id/tags", auth, formation.removeTag); // non utilisé
router.put("/:id/publier", auth, verifUserFormation, formation.publish);
router.get("/:id/editors", auth, formation.getEditors);
router.post("/:id/contributors", auth, formation.addContributors);
router.get("/:id/contributors", formation.getContributors);
router.get(
  "/:id/contributors/token-info",
  auth,
  formation.getContributorsByToken
);
router.put("/:id/header", auth, verifUserFormation, formation.addHeader);
router.put("/:id/contenu", auth, verifUserFormation, formation.putContenu);
router.get("/:id/contenu", formation.getContenu);
router.put("/:id_formation/contenu/:id_page", formation.putBlock);
router.post(
  "/:id_formation/contenu/:id_page/bloc/:id_bloc",
  auth,
  formation.postBlock
);
router.delete(
  "/:id_formation/contenu/:id_page/bloc/:id_bloc/proposal/:id_proposal",
  auth,
  verifUserFormation,
  formation.deleteProposerBlock
);


export default router;