import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { addMovie, getMovies, streamMovieVideo, listMovieFiles, downloadMovieVideo } from "../controllers/movie.controller.js";
import path from "path";
import multer from "multer";

const router = express.Router();

import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"), false);
    }
  },
});

router.post("/add", protectRoute, upload.single("video"), addMovie);
router.get("/", protectRoute, getMovies);
// Remove protectRoute middleware from stream route to allow public access for testing
router.get("/stream/:id", streamMovieVideo);

router.get("/files", listMovieFiles);

router.get("/download/:id", downloadMovieVideo);

export default router;
