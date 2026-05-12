import express from 'express';
import { getMonthlyReport, getCategoryReport } from '../controllers/report.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/monthly', getMonthlyReport);
router.get('/category', getCategoryReport);

export default router;
