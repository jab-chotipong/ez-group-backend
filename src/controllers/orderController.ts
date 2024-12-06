import { Request, Response } from 'express'
import pool from '../config/db'
import { ResultSetHeader, RowDataPacket } from 'mysql2'

export const createOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { customerId, products, redemptionCode } = req.body

  if (!products || !Array.isArray(products) || !customerId) {
    res.status(400).json({ error: 'products and customerId are required.' })
    return
  }

  try {
    let totalPrice = 0

    // Validate each product and calculate total price
    for (const { productId, quantity } of products) {
      if (!productId || !quantity) {
        res
          .status(400)
          .json({ error: 'Each product must have productId and quantity.' })
        return
      }

      // Fetch product details
      const [productRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM products WHERE id = ?',
        [productId]
      )
      if (productRows.length === 0) {
        res
          .status(404)
          .json({ error: `Product with ID ${productId} not found.` })
        return
      }

      const product = productRows[0]
      if (quantity > product.stock) {
        res.status(400).json({
          error: `Requested quantity (${quantity}) for product ID ${productId} exceeds available stock (${product.stock}).`,
        })
        return
      }

      totalPrice += product.price * quantity
    }

    // Validate customer
    const [customerRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM customers WHERE id = ?',
      [customerId]
    )
    if (customerRows.length === 0) {
      res.status(404).json({ error: 'Customer not found.' })
      return
    }

    const customer = customerRows[0]
    let discount = 0

    // Validate redemption code
    if (redemptionCode) {
      const [codeRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM codes WHERE code = ? AND status = "active"',
        [redemptionCode]
      )
      if (codeRows.length === 0) {
        res.status(400).json({ error: 'Invalid code.' })
        return
      }

      const code = codeRows[0]
      discount = code.discount
    }

    const finalPrice = totalPrice - discount

    // Deduct stock for each product
    for (const { productId, quantity } of products) {
      await pool.query(
        'UPDATE products SET stock = stock - ?, status = IF(stock - ? > 0, "IN-STOCK", "SOLD") WHERE id = ?',
        [quantity, quantity, productId]
      )
    }

    // Deduct customer balance
    await pool.query(
      'UPDATE customers SET balance = balance - ? WHERE id = ?',
      [totalPrice, customerId]
    )

    // Create new order
    const [orderResult] = await pool.query<ResultSetHeader>(
      'INSERT INTO orders (customerId, products, totalPrice, status, redemptionCode, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [
        customerId,
        JSON.stringify(products), // Convert products array to JSON
        finalPrice,
        'PROCESSING',
        redemptionCode || null,
      ]
    )

    res.status(201).json({
      orderId: orderResult.insertId,
      customerId,
      products,
      totalPrice,
      discount,
      finalPrice,
      status: 'PROCESSING',
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}

export const getAllOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { page = 1, limit = 10 } = req.query

  const offset = (Number(page) - 1) * Number(limit)

  try {
    const query = `
      SELECT 
        o.id, 
        o.customerId, 
        CONCAT(c.firstname, ' ', c.lastname) AS fullname,
        o.products, 
        o.totalPrice, 
        o.redemptionCode, 
        o.status, 
        o.createdAt, 
        o.updatedAt
      FROM orders o
      INNER JOIN customers c ON o.customerId = c.id
      LIMIT ? OFFSET ?
    `
    const [orders] = await pool.query(query, [Number(limit), offset])

    const enhancedOrders = await Promise.all(
      (orders as any[]).map(async (order) => {
        let products

        if (typeof order.products === 'string') {
          products = JSON.parse(order.products)
        } else {
          products = order.products
        }

        const enhancedProducts = await Promise.all(
          products.map(async (product: any) => {
            const [productRows] = await pool.query<RowDataPacket[]>(
              'SELECT name FROM products WHERE id = ?',
              [product.productId]
            )

            if (productRows.length > 0) {
              product.name = productRows[0].name
            }

            return product
          })
        )

        return { ...order, products: enhancedProducts }
      })
    )

    const [totalResult] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM orders'
    )
    const total = totalResult[0]?.total || 0

    res.status(200).json({
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
      data: enhancedOrders,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}

export const getOrderById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params

  if (!id) {
    res.status(400).json({ error: 'Order ID is required.' })
    return
  }

  try {
    const query = `
      SELECT id, customerId, products, totalPrice, redemptionCode, status, createdAt, updatedAt
      FROM orders
      WHERE id = ?
    `

    const [rows] = await pool.query<RowDataPacket[]>(query, [id])

    if (rows.length === 0) {
      res.status(404).json({ error: 'Order not found.' })
      return
    }

    res.status(200).json(rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}

export const updateOrderStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params
  const { status } = req.body

  if (!id || !status) {
    res.status(400).json({ error: 'Order ID and status are required.' })
    return
  }

  try {
    const validStatuses = ['PROCESSING', 'COMPLETED', 'FAILED']
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        error: `Invalid status. Valid statuses are: ${validStatuses.join(
          ', '
        )}`,
      })
      return
    }

    const query = `
      UPDATE orders
      SET status = ?, updatedAt = NOW()
      WHERE id = ?
    `
    const [result] = await pool.query<RowDataPacket[]>(query, [status, id])

    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: 'Order not found or status already set.' })
      return
    }

    const [updatedOrder] = await pool.query<RowDataPacket[]>(
      `SELECT id, customerId, products, totalPrice, redemptionCode, status, createdAt, updatedAt FROM orders WHERE id = ?`,
      [id]
    )

    res.status(200).json({
      message: 'Order status updated successfully.',
      order: updatedOrder[0],
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}
