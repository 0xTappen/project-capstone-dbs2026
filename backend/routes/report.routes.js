import express from 'express';
import { getMonthlyReport, getCategoryReport } from '../controllers/report.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';
import requireProfileCompletion from '../middleware/requireProfileCompletion.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireProfileCompletion);

router.get('/monthly', getMonthlyReport);
router.get('/category', getCategoryReport);

export default router;
