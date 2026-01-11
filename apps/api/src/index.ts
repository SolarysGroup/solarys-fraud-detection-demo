import { config } from "dotenv";
import { resolve } from "path";

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, "../../../.env") });

import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { errorHandler } from "./middleware/error-handler.js";
import healthRouter from "./routes/health.js";
import toolsRouter from "./routes/tools.js";
import chatRouter from "./routes/chat.js";

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT ?? 3001;

// Rate limiting for chat endpoint (5 requests per IP per hour)
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour per IP
  message: {
    error: "Rate limit exceeded",
    message: "You've reached the maximum of 5 requests per hour. This is a demo application with limited API capacity. Please try again later.",
    retryAfter: "1 hour"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Root route for Railway health check (default path)
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "api" });
});

// Routes
app.use("/health", healthRouter);
app.use("/api/tools", toolsRouter);
app.use("/api/chat", chatLimiter, chatRouter);

// Error handling
app.use(errorHandler);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`API server running on http://0.0.0.0:${PORT}`);
});

export default app;
