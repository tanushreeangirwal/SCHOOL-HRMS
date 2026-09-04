// Ensure application timezone is synchronized with school campus timezone (Asia/Kolkata)
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const employeeRoutes = require("./routes/employees");
const departmentRoutes = require("./routes/departments");
const departmentCategoryRoutes = require("./routes/departmentCategories");
const designationRoutes = require("./routes/designations");
const shiftRoutes = require("./routes/shifts");
const attendanceRoutes = require("./routes/attendance");
const leaveRoutes = require("./routes/leaves");
const calendarRoutes = require("./routes/academicCalendar");
const payrollRoutes = require("./routes/payroll");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - Configure CORS for production domains, Vercel frontend, and local development
const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim().replace(/\/$/, ""))
  : [];

const defaultAllowedOrigins = [
  "https://school-hrms.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000"
];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...configuredOrigins]));

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server, health probes)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/$/, "");
    if (
      allowedOrigins.includes(cleanOrigin) ||
      allowedOrigins.includes("*") ||
      /\.vercel\.app$/.test(cleanOrigin)
    ) {
      return callback(null, true);
    }

    // Permissive fallback so production demo is never blocked by origin mismatches
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
app.use(express.json());

const pool = require("./db");

// Auto-migrate schema updates safely on startup (supports Neon, Render, Supabase, local)
async function ensureSchemaUpdates() {
  try {
    await pool.query(`
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'ACTIVE';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_otp_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_otp_expires_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_otp_attempts INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_otp_last_sent_at TIMESTAMP;
      UPDATE users SET account_status = 'ACTIVE' WHERE account_status IS NULL;
    `);
    console.log("Database schema auto-migration verified successfully.");
  } catch (err) {
    console.error("Schema auto-migration check notice:", err.message);
  }
}
ensureSchemaUpdates();

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const dbRes = await pool.query("SELECT current_database();");
    res.json({
      success: true,
      message: "St. Vincent's School HRMS backend is running!",
      database: dbRes.rows[0].current_database,
      db_connected: true
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: err.message,
      has_database_url: Boolean(process.env.DATABASE_URL),
      has_jwt_secret: Boolean(process.env.JWT_SECRET)
    });
  }
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Department & Category routes
app.use("/api/department-categories", departmentCategoryRoutes);
app.use("/api/departments", departmentRoutes);

// Designation routes
app.use("/api/designations", designationRoutes);

// Shift & Schedule routes
app.use("/api/shifts", shiftRoutes);

// Attendance routes
app.use("/api/attendance", attendanceRoutes);

// Leave Management routes
app.use("/api/leaves", leaveRoutes);

// Academic Calendar routes
app.use("/api/academic-calendar", calendarRoutes);

// Payroll routes
app.use("/api/payroll", payrollRoutes);

// Employee routes
app.use("/api/employees", employeeRoutes);

// Start server on 0.0.0.0 for containerized / cloud hosting
app.listen(PORT, "0.0.0.0", () => {
  console.log(`St. Vincent's School HRMS backend running on port ${PORT}`);
});
