import express from 'express'
const router = express.Router()

import { getLogin, postLogin, getRegister, postRegister, postLogout } from "../controllers/auth.controller.js";

router.route("/login").get(getLogin).post(postLogin);
router.route("/register").get(getRegister).post(postRegister);
router.get("/logout", postLogout);

export default router;