const { Pool } = require("pg");
require("dotenv").config();

// Determine SSL configuration for cloud hosting (e.g. Render, Supabase, Neon, Railway, RDS)
const isCloudUrl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost") && !process.env.DATABASE_URL.includes("127.0.0.1");
const isSslEnabled = process.env.DB_SSL === "true" || isCloudUrl || (process.env.NODE_ENV === "production" && !process.env.DB_HOST?.includes("localhost"));
const sslConfig = isSslEnabled ? { rejectUnauthorized: false } : false;

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: sslConfig
    };

const pool = new Pool(poolConfig);

module.exports = pool;