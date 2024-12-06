import express from 'express'
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
} from '../controllers/orderController'

const router = express.Router()

router.post('/orders', createOrder)
router.get('/orders', getAllOrders)
router.get('/orders/:orderId', getOrderById)
router.patch('/orders/:id/status', updateOrderStatus)

export default router
