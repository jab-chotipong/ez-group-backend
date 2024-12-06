import { Request, Response } from 'express'
import pool from '../config/db'
import { RowDataPacket } from 'mysql2'

export const getAllCodes = async (
  req: Request,
  res: Response
): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 10
  const offset = (page - 1) * limit

  if (page <= 0 || limit <= 0) {
    res.status(400).json({ error: 'page and limit must be positive integers.' })
    return
  }

  try {
    const query = `
      SELECT id, discount, code, status, createdAt, expiredAt
      FROM codes
      LIMIT ? OFFSET ?
    `
    const [rows] = await pool.query<RowDataPacket[]>(query, [limit, offset])

    const [totalResult] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM codes'
    )
    const total = totalResult[0]?.total || 0

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      data: rows,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}

export const verifyCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { code } = req.query

  if (!code) {
    res.status(400).json({ error: 'Code is required.' })
    return
  }

  try {
    const query = `
      SELECT discount, status
      FROM codes
      WHERE LOWER(code) = LOWER(?)
    `
    const [rows] = await pool.query<RowDataPacket[]>(query, [code])

    if (rows.length === 0) {
      res.status(404).json({ error: 'Code not found.' })
      return
    }

    const { discount, status } = rows[0]

    if (status !== 'active') {
      res.status(400).json({ error: 'Code is not valid.' })
      return
    }

    res.status(200).json({ code, discount, status })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}

export const editCode = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const { discount, code, status, expiredAt } = req.body

  if (!id) {
    res.status(400).json({ error: 'Code ID is required.' })
    return
  }

  try {
    const [existingCode] = await pool.query(
      'SELECT * FROM codes WHERE id = ?',
      [id]
    )

    if ((existingCode as any[]).length === 0) {
      res.status(404).json({ error: 'Code not found.' })
      return
    }

    const updateQuery = `
      UPDATE codes
      SET
        discount = COALESCE(?, discount),
        code = COALESCE(?, code),
        status = COALESCE(?, status),
        expiredAt = COALESCE(?, expiredAt),
        updatedAt = NOW()
      WHERE id = ?
    `

    await pool.query(updateQuery, [discount, code, status, expiredAt, id])

    const [updatedCode] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM codes WHERE id = ?',
      [id]
    )

    res
      .status(200)
      .json({ message: 'Code updated successfully.', code: updatedCode[0] })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: (error as Error).message })
  }
}

export const addCode = async (req: Request, res: Response): Promise<void> => {
  const { discount, code, status, expiredAt } = req.body

  if (!discount || !code || !status) {
    res.status(400).json({ error: 'Discount, code, and status are required.' })
    return
  }

  try {
    const insertQuery = `
      INSERT INTO codes (discount, code, status, expiredAt)
      VALUES (?, ?, ?, ?)
    `

    const [result] = await pool.query(insertQuery, [
      discount,
      code,
      status,
      expiredAt || null, // Allow expiredAt to be NULL
    ])

    const newCodeId = (result as any).insertId

    const [newCode] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM codes WHERE id = ?',
      [newCodeId]
    )

    res
      .status(201)
      .json({ message: 'Code added successfully.', code: newCode[0] })
  } catch (error) {
    console.error(error)
    if ((error as any).code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Code already exists.' })
    } else {
      res.status(500).json({ error: (error as Error).message })
    }
  }
}
