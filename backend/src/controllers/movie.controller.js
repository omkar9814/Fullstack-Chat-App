import Movie from "../models/movie.model.js";
import mongoose from "mongoose";

import fs from "fs";

const addMovie = async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({ error: "Video file is required" });
    }

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "movies",
    });

    // Stream file from disk to GridFS with Promise to await completion
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(req.file.filename, {
        metadata: { userId },
      });

      const fileStream = fs.createReadStream(req.file.path);

      fileStream.pipe(uploadStream);

      uploadStream.on("error", (error) => {
        console.error("Error uploading file to GridFS:", error);
        reject(error);
      });

      uploadStream.on("finish", () => {
        // Delete temp file after upload
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting temp file:", err);
        });
        console.log("Uploaded file ID:", uploadStream.id.toString());
        resolve(uploadStream.id);
      });
    });

    const fileId = await uploadPromise;

    // Create movie document with videoUrl pointing to stream endpoint
    const videoUrl = `/api/movies/stream/${fileId}`;
    console.log("Saving movie with videoUrl:", videoUrl);

    const movie = new Movie({
      title,
      videoUrl,
      createdBy: userId,
    });

    await movie.save();

    res.status(201).json({ message: "Movie added", data: movie });
  } catch (error) {
    console.error("Error in addMovie:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getMovies = async (req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 });
    res.status(200).json(movies);
  } catch (error) {
    console.error("Error in getMovies:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const streamMovieVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "movies",
    });

    const _id = new mongoose.Types.ObjectId(id);

    // Check if file exists in GridFS before streaming
    const files = await bucket.find({ _id }).toArray();
    if (!files || files.length === 0) {
      console.error("File not found in GridFS:", id);
      return res.status(404).send("Video not found");
    }

    const file = files[0];
    const range = req.headers.range;
    const fileSize = file.length;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).set({
          "Content-Range": `bytes */${fileSize}`,
        }).end();
        return;
      }

      const chunkSize = end - start + 1;
      res.status(206).set({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/mp4",
      });

      const downloadStream = bucket.openDownloadStream(_id, {
        start,
        end: end + 1,
      });

      downloadStream.on("error", (error) => {
        console.error("Error streaming video from GridFS:", error);
        if (!res.headersSent) {
          res.status(404).send("Video not found");
        }
      });

      downloadStream.pipe(res);
    } else {
      res.status(200).set({
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
      });

      const downloadStream = bucket.openDownloadStream(_id);

      downloadStream.on("error", (error) => {
        console.error("Error streaming video from GridFS:", error);
        if (!res.headersSent) {
          res.status(404).send("Video not found");
        }
      });

      downloadStream.pipe(res);
    }
  } catch (error) {
    console.error("Error in streamMovieVideo:", error);
    res.status(500).send("Internal server error");
  }
};

const listMovieFiles = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "movies",
    });

    const files = await bucket.find({}).toArray();
    res.status(200).json(files);
  } catch (error) {
    console.error("Error listing movie files:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const downloadMovieVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "movies",
    });

    const _id = new mongoose.Types.ObjectId(id);

    // Check if file exists in GridFS before streaming
    const files = await bucket.find({ _id }).toArray();
    if (!files || files.length === 0) {
      console.error("File not found in GridFS:", id);
      return res.status(404).send("Video not found");
    }

    const file = files[0];
    const filename = file.filename || "video.mp4";

    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": file.length,
    });

    const downloadStream = bucket.openDownloadStream(_id);

    downloadStream.on("error", (error) => {
      console.error("Error downloading video from GridFS:", error);
      if (!res.headersSent) {
        res.status(404).send("Video not found");
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error("Error in downloadMovieVideo:", error);
    res.status(500).send("Internal server error");
  }
};

export { addMovie, getMovies, streamMovieVideo, listMovieFiles, downloadMovieVideo };
