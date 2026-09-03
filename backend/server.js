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

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - Configure CORS for production domains and local development
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim())
  : true;

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "St. Vincent's School HRMS backend is running!"
  });
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

// Employee routes
app.use("/api/employees", employeeRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`St. Vincent's School HRMS backend running on port ${PORT}`);
});
