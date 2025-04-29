// src/routes/message.route.js
import express from "express";
import multer from "multer";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMessages,
  getUsersForSidebar,
  sendMessage,
  markMessageAsRead,
  reactToMessage,
  editMessage,
  deleteMessage,
} from "../controllers/message.controller.js";

const router = express.Router();


// Configure Multer to store files in memory (you can switch to diskStorage if you like)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only image or video mime types
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"), false);
    }
  },
});

router.get("/users", protectRoute, getUsersForSidebar);

router.get("/:id", protectRoute, getMessages);

// Use multer.fields to accept one image and one video at most
router.post(
  "/send/:id",
  protectRoute,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  sendMessage
);

// New routes for added features
router.post("/:id/read", protectRoute, markMessageAsRead);
router.post("/:id/react", protectRoute, reactToMessage);
router.patch("/:id", protectRoute, editMessage);
router.delete("/:id", protectRoute, deleteMessage);

export default router;
