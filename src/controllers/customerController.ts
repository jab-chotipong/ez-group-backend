import { Request, Response } from 'express'
import pool from '../config/db'
import { RowDataPacket } from 'mysql2'

export const getCustomerBalance = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { customerId } = req.params

  if (!customerId) {
    res.status(400).json({ error: 'Customer ID is required.' })
    return
  }

  try {
    const query = 'SELECT id, balance FROM customers WHERE id = ?'
    const params = [customerId]

    const [rows] = await pool.query<RowDataPacket[]>(query, params)

    if (rows.length === 0) {
      res.status(404).json({ error: 'Customer not found.' })
      return
    }

    const customer = rows[0]
    res.status(200).json({ id: customer.id, balance: customer.balance })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}

export const searchCustomers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { term } = req.query

  if (!term) {
    res.status(400).json({ error: 'Search term is required.' })
    return
  }

  try {
    const query = `
      SELECT id as value, CONCAT(firstname, ' ', lastname) AS label
      FROM customers
      WHERE CONCAT(firstname, ' ', lastname) LIKE ?
    `
    const params = [`%${term}%`]

    const [rows] = await pool.query<RowDataPacket[]>(query, params)
    res.status(200).json(rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}
