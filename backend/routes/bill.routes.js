import express from 'express';
import {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  payBill
} from '../controllers/bill.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';
import requireProfileCompletion from '../middleware/requireProfileCompletion.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireProfileCompletion);

router.get('/', getBills);
router.get('/:id', getBillById);
router.post('/', createBill);
router.put('/:id', updateBill);
router.delete('/:id', deleteBill);
router.patch('/:id/pay', payBill);

export default router;
