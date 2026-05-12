import express from 'express';
import {
  chat,
  getHistory,
  clearHistory,
  listSessions,
  createSession,
  updateSessionTitle,
  deleteSession,
} from '../controllers/chatbot.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/sessions', listSessions);
router.post('/sessions', createSession);
router.patch('/sessions/:sessionId', updateSessionTitle);
router.delete('/sessions/:sessionId', deleteSession);

router.post('/', chat);
router.get('/history', getHistory);
router.delete('/history', clearHistory);

export default router;
