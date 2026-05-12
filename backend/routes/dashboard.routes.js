import express from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/summary', getDashboardSummary);

export default router;
