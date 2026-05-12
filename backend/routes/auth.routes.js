import express from 'express';
import {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
} from '../controllers/auth.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateMe);
router.put('/change-password', authMiddleware, changePassword);

export default router;
