import express from 'express'
import {
  getProducts,
  searchProducts,
  updateProduct,
} from '../controllers/productController'

const router = express.Router()

router.get('/products', getProducts)
router.get('/products/search', searchProducts)
router.patch('/products/:id', updateProduct)

export default router
