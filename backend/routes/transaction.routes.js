import express from 'express';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction
} from '../controllers/transaction.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';
import requireProfileCompletion from '../middleware/requireProfileCompletion.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireProfileCompletion);

router.get('/', getTransactions);
router.get('/:id', getTransactionById);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
