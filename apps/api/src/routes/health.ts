import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.0.1",
  });
});

export default router;
