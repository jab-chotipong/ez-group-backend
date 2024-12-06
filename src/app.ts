import express from 'express'
import dotenv from 'dotenv'
import productRoutes from './routes/productRoutes'
import orderRoutes from './routes/orderRoutes'
import customerRoutes from './routes/customerRoutes'
import codeRoutes from './routes/codeRoutes'

const cors = require('cors')

dotenv.config()

const app = express()
app.use(
  cors({
    origin: 'http://localhost:4000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
)
app.use(express.json())

app.use('/api', productRoutes)
app.use('/api', orderRoutes)
app.use('/api', customerRoutes)
app.use('/api', codeRoutes)

export default app
