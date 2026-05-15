import express from 'express';
import {
  getBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget
} from '../controllers/budget.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';
import requireProfileCompletion from '../middleware/requireProfileCompletion.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireProfileCompletion);

router.get('/', getBudgets);
router.get('/:id', getBudgetById);
router.post('/', createBudget);
router.put('/:id', updateBudget);
router.delete('/:id', deleteBudget);

export default router;
