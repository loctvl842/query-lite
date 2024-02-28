const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
// Set up middleware to parse request body
app.use(bodyParser.urlencoded({ extended: true }));
// Session middleware
app.use(
  session({
    secret: "not so secret secret",
    resave: false,
    saveUninitialized: false,
  }),
);

// Middleware to establish database connection
app.use((req, res, next) => {
  console.log("Middleware to establish database connection");
  // Check if connection information is stored in session
  if (req.session.connectionInfo) {
    const { host, port, schema, dbName, username, password } =
      req.session.connectionInfo;
    const pool = new Pool({
      user: username,
      host: host,
      schema: schema,
      database: dbName,
      password: password,
      port: parseInt(port),
    });

    // Attach the database connection to the request object for subsequent route handlers
    req.db = pool;
  } else {
    if (req.path !== "/" && req.path !== "/connect") {
      res.redirect("/"); // Redirect to the root endpoint
      return;
    }
  }
  next();
});

// Define a route to fetch data from the database
app.get("/", (req, res) => {
  res.render("login");
});

app.post("/connect", async (req, res) => {
  const { host, port, schema, dbName, username, password } = req.body;

  // Create a PostgreSQL client
  const pool = new Pool({
    user: username,
    host: host,
    database: dbName,
    password: password,
    schema: schema,
    port: parseInt(port), // Convert port to integer
  });

  try {
    // Test the database connection by querying a simple table
    const testQuery = "SELECT 1";
    await pool.query(testQuery);

    // Store the connection information in the session
    req.session.connectionInfo = {
      host,
      port,
      schema,
      dbName,
      username,
      password,
    };

    // Redirect to the /tables page after successful connection
    res.redirect("/tables");
  } catch (error) {
    // Handle connection error
    console.error("Error connecting to PostgreSQL:", error);
    res.status(500).send("Failed to connect to the database");
  } finally {
    // Release the client from the pool
    pool.end();
  }
});

app.get("/tables", async (req, res) => {
  const pool = req.db;
  try {
    query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = '${pool.options.schema}'
      AND table_type = 'BASE TABLE';
    `;
    const tableNamesResult = await pool.query(query);
    const tableNames = tableNamesResult.rows.map((row) => row.table_name);

    res.render("tables", { tableNames });
  } catch (err) {
    console.error("Error fetching data from PostgreSQL:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/tables/:tableName", async (req, res) => {
  const pool = req.db;
  try {
    const tableName = req.params.tableName;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;

    const countQuery = `
      SELECT COUNT(*)
      FROM ${pool.options.schema}.${tableName}
    `;

    const columnNamesQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = '${tableName}' AND table_schema = '${pool.options.schema}';
    `;
    console.log("columnNamesQuery", columnNamesQuery);

    const query = `
      SELECT *
      FROM ${pool.options.schema}.${tableName}
      OFFSET ${offset}
      LIMIT ${limit}
    `;

    const [countResult, dataResult, columnNamesResult] = await Promise.all([
      pool.query(countQuery),
      pool.query(query),
      pool.query(columnNamesQuery),
    ]);

    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    const columnNames = columnNamesResult.rows.map((row) => row.column_name);

    res.render("table-detail", {
      dataRows: dataResult.rows,
      columnNames,
      tableName,
      offset,
      limit,
      totalCount,
      totalPages,
      currentPage,
    });
  } catch (err) {
    console.error("Error fetching data from PostgreSQL:", err);
    res.status(500).send("Internal Server Error");
  }
});

const port = 8402;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
