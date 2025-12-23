import { config } from "dotenv";
import { resolve } from "path";

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, "../../../.env") });

import cors from "cors";
import express from "express";
import helmet from "helmet";

import { errorHandler } from "./middleware/error-handler.js";
import healthRouter from "./routes/health.js";
import toolsRouter from "./routes/tools.js";
import chatRouter from "./routes/chat.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use("/health", healthRouter);
app.use("/api/tools", toolsRouter);
app.use("/api/chat", chatRouter);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export default app;
