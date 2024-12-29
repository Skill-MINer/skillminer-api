import { Router } from "express";

import { auth } from "../../middleware/authentication.js";
import * as tag from '../../controllers/tag.js'

import formationRoutes from './formation.js'
import fileRoutes from './file.js'
import userRoutes from './user.js'

const router = Router();
const URL_BACK = `${process.env.URL_BACK}:${process.env.PORT}`;

router.route("/").get((req, res) => {
  // #swagger.tags = ['Default']
  res.send(`<h2>API de SkillMINER, documentation ${URL_BACK}/swagger</h2>`);
});

router.get("/tags", tag.getTags
  /**
   * #swagger.tags = ['Tags']
   * #swagger.description = 'get all available tags'
  */
);
router.post("/tags", auth, tag.addTag
  /**
   * #swagger.tags = ['Tags']
   * #swagger.description = 'Add a tag to the tag's list'
  */
); // non utilisé

router.use("/formations", formationRoutes
  // #swagger.tags = ['Formations']
)
router.use("/file", fileRoutes
  // #swagger.tags = ['Files']
)
router.use("/users", userRoutes
  // #swagger.tags = ['Users']
)

export default router;