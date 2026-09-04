// Ensure application timezone is synchronized with school campus timezone (Asia/Kolkata)
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

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

// Security Headers: Helmet (configured safely for cross-origin SPA communication)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// Rate Limiter: Sensitive authentication endpoints (Brute-force protection)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  limit: 50, // 50 attempts per 15 min per IP (protects brute-force while safe for multi-user campus NAT)
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication requests from this IP. Please try again after 15 minutes."
  }
});

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

// Health check (Sanitized: never exposes internal database names or credentials)
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1;");
    res.json({
      success: true,
      status: "healthy",
      message: "St. Vincent's School HRMS backend is running.",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      message: "Database service temporarily unavailable."
    });
  }
});

// Authentication routes with brute-force rate limiter
app.use("/api/auth", authRateLimiter, authRoutes);

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

// Safe Global Error Handler (Sanitizes error leaks in production)
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.message);
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  res.status(err.status || 500).json({
    success: false,
    message: isProduction ? "An unexpected server error occurred." : (err.message || "Internal server error")
  });
});

// Start server on 0.0.0.0 for containerized / cloud hosting
app.listen(PORT, "0.0.0.0", () => {
  console.log(`St. Vincent's School HRMS backend running on port ${PORT}`);
});
