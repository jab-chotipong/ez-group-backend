import express from 'express'
import {
  getCustomerBalance,
  searchCustomers,
} from '../controllers/customerController'

const router = express.Router()

router.get('/customers/:customerId/balance', getCustomerBalance)
router.get('/customers/search', searchCustomers)

export default router
