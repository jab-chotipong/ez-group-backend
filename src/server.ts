import app from './app'

const PORT = process.env.PORT || 3000

app.listen(PORT, () =>
  console.log(
    `Server is running on http://localhost:${PORT}, Database: ${process.env.DB_NAME}`
  )
)
