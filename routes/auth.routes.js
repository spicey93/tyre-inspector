import express from 'express'
const router = express.Router()

import { getLogin, postLogin, getRegister, postRegister, postLogout } from "../controllers/auth.controller.js";
import redirectIfAuthenticated from "../middleware/redirectIfAuthenticated.js";

router.route("/login").get(redirectIfAuthenticated, getLogin).post(postLogin);
router.route("/register").get(redirectIfAuthenticated, getRegister).post(postRegister);
router.get("/logout", postLogout);

export default router;