import { Request, Response } from 'express'
import pool from '../config/db'
import { RowDataPacket } from 'mysql2'

export const getProducts = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 10
  const offset = (page - 1) * limit

  if (page <= 0 || limit <= 0) {
    res.status(400).json({ error: 'page and limit must be positive integers.' })
    return
  }

  try {
    const [products] = await pool.query(
      'SELECT * FROM products LIMIT ? OFFSET ?',
      [limit, offset]
    )

    // total products
    const [countResult] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM products'
    )
    const total = countResult[0].total

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: products,
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export const searchProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { term } = req.query

  if (!term) {
    res.status(400).json({ error: 'Product name is required for searching.' })
    return
  }

  try {
    const query = `
      SELECT id as value, name as label, price
      FROM products
      WHERE name LIKE ? AND status = 'IN-STOCK'
    `
    const params = [`%${term}%`]

    const [rows] = await pool.query(query, params)

    res.status(200).json(rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params
  const { name, price, stock, status } = req.body

  if (!id) {
    res.status(400).json({ error: 'Product ID is required.' })
    return
  }

  if (!name && !price && !stock && !status) {
    res.status(400).json({
      error:
        'At least one field (name, price, stock, or status) is required to update.',
    })
    return
  }

  try {
    const validStatuses = ['IN-STOCK', 'RESERVED', 'SOLD']

    let finalStatus = status
    if (stock == 0) {
      finalStatus = 'SOLD'
    } else if (status && !validStatuses.includes(status)) {
      res.status(400).json({
        error: `Invalid status. Valid statuses are: ${validStatuses.join(
          ', '
        )}`,
      })
      return
    }

    const query = `
      UPDATE products
      SET 
        name = COALESCE(?, name),
        price = COALESCE(?, price),
        stock = COALESCE(?, stock),
        status = COALESCE(?, status),
        updatedAt = NOW()
      WHERE id = ?
    `
    const [result] = await pool.query(query, [
      name,
      price,
      stock,
      finalStatus,
      id,
    ])

    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: 'Product not found or no changes made.' })
      return
    }

    const [updatedProduct] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM products WHERE id = ?',
      [id]
    )

    res.status(200).json({
      message: 'Product updated successfully.',
      product: updatedProduct[0],
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}
