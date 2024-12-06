import express from 'express'
import {
  addCode,
  editCode,
  getAllCodes,
  verifyCode,
} from '../controllers/codeController'

const router = express.Router()

router.get('/codes', getAllCodes)
router.get('/codes/verify', verifyCode)
router.post('/codes', addCode)
router.patch('/codes/:id', editCode)

export default router
