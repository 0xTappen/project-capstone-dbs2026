import express from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';
import requireProfileCompletion from '../middleware/requireProfileCompletion.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireProfileCompletion);

router.get('/summary', getDashboardSummary);

export default router;
