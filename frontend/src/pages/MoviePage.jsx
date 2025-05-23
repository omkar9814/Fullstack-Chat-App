import { useState, useEffect, useRef } from "react";
import { axiosInstance } from "../lib/axios";
import AdSenseAd from "../components/AdSenseAd";

const MoviePage = () => {
  const [title, setTitle] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const uploadStartTime = useRef(null);
  const currentlyPlayingVideo = useRef(null);
  const currentlyPlayingIndex = useRef(null);

  const fetchMovies = async () => {
    try {
      const res = await axiosInstance.get("/movies");
      setMovies(res.data);
    } catch (error) {
      console.error("Failed to fetch movies", error);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !videoFile) {
      alert("Please provide both title and video file");
      return;
    }
    setLoading(true);
    setUploadProgress(0);
    setTimeRemaining(null);
    uploadStartTime.current = Date.now();
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("video", videoFile);

      const res = await axiosInstance.post("/movies/add", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          const percentCompleted = Math.round((loaded * 100) / total);
          setUploadProgress(percentCompleted);

          const elapsedTime = (Date.now() - uploadStartTime.current) / 1000; // seconds
          const uploadSpeed = loaded / elapsedTime; // bytes per second
          const bytesRemaining = total - loaded;
          const secondsRemaining = bytesRemaining / uploadSpeed;
          setTimeRemaining(secondsRemaining);
        },
      });

      setTitle("");
      setVideoFile(null);
      fetchMovies();
      alert("Movie added successfully");
    } catch (error) {
      console.error("Failed to add movie", error);
      alert("Failed to add movie");
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setTimeRemaining(null);
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null || isNaN(seconds)) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const handlePlay = (event, index) => {
    if (currentlyPlayingVideo.current && currentlyPlayingVideo.current !== event.target) {
      const pausePromise = currentlyPlayingVideo.current.pause();
      if (pausePromise !== undefined) {
        pausePromise.catch(() => {
          // Ignore pause promise rejection
        });
      }
    }
    currentlyPlayingVideo.current = event.target;
    currentlyPlayingIndex.current = index;
  };

  const handleEnded = () => {
    if (currentlyPlayingIndex.current === null) return;
    const nextIndex = currentlyPlayingIndex.current + 1;
    if (nextIndex < movies.length) {
      const nextVideoElement = document.querySelectorAll("video")[nextIndex];
      if (nextVideoElement) {
        nextVideoElement.muted = true;
        const playPromise = nextVideoElement.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            nextVideoElement.muted = false;
          }).catch(error => {
            console.error("Error playing next video:", error);
          });
        }
        currentlyPlayingVideo.current = nextVideoElement;
        currentlyPlayingIndex.current = nextIndex;
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 min-h-screen">
      <h1 className="text-4xl font-extrabold mb-16 mt-10 text-center text-indigo-900 bg-white bg-opacity-80 p-2 rounded-md shadow-md inline-block mx-auto">Movies</h1>

      <form onSubmit={handleSubmit} className="mb-10 bg-white p-6 rounded-lg shadow-md max-w-xl mx-auto">
        <div className="mb-6">
          <label className="block mb-2 font-semibold text-gray-700">Title</label>
          <input
            type="text"
            className="input input-bordered w-full border-indigo-300 focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            required
            placeholder="Enter movie title"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 font-semibold text-gray-700">Video File</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files[0])}
            disabled={loading}
            required
            className="file-input file-input-bordered w-full"
          />
        </div>

        <button
          type="submit"
          className="btn btn-indigo w-full text-white font-semibold hover:bg-indigo-700 transition-colors"
          disabled={loading}
        >
          {loading ? "Uploading..." : "Add Movie"}
        </button>
      </form>

      {loading && (
        <div className="mb-8 max-w-xl mx-auto">
          <progress
            className="progress progress-primary w-full rounded-md"
            value={uploadProgress}
            max="100"
          ></progress>
          <p className="mt-2 text-sm text-gray-600 text-center">
            Upload Progress: {uploadProgress}%{" "}
            {timeRemaining !== null && `- Time Remaining: ${formatTime(timeRemaining)}`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {movies.length === 0 ? (
          <p className="text-center text-gray-500 col-span-full">No movies available</p>
        ) : (
          movies.map((movie, index) => (
            <div key={movie._id} className="bg-white rounded-lg shadow-lg p-4 flex flex-col">
              <h2 className="text-2xl font-semibold mb-4 text-indigo-800 truncate">{movie.title}</h2>
              <video
                key={movie._id}
                controls
                className="w-full rounded-md shadow-md mb-4 border border-indigo-300 max-h-[60vh] sm:max-h-96"
                onError={(e) => {
                  console.error("Video playback error for movie:", movie.title);
                  e.target.poster = "/fallback-poster.png"; // optional fallback poster image
                }}
                onPlay={(e) => handlePlay(e, index)}
                src={movie.videoUrl.startsWith("http") ? movie.videoUrl : `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5001"}${movie.videoUrl}`}
                onEnded={handleEnded}
              >
                <source src={movie.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              <a
                href={movie.videoUrl.replace("/stream/", "/download/").startsWith("http") ? movie.videoUrl.replace("/stream/", "/download/") : `${import.meta.env.VITE_BACKEND_URL}${movie.videoUrl.replace("/stream/", "/download/")}`}
                className="btn btn-indigo mt-auto text-white font-semibold hover:bg-indigo-700 transition-colors"
                download={`${movie.title || "video"}.mp4`}
              >
                Download Video
              </a>
              <button
                onClick={async () => {
                  if (window.confirm(`Are you sure you want to delete "${movie.title}"?`)) {
                    try {
                      await axiosInstance.delete(`/movies/${movie._id}`);
                      alert("Movie deleted successfully");
                      fetchMovies();
                    } catch (error) {
                      console.error("Failed to delete movie", error);
                      alert("Failed to delete movie");
                    }
                  }
                }}
                className="btn btn-red mt-2 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                Delete Video
              </button>
            </div>
          ))
        )}
      </div>

      {/* Google AdSense Ad */}
      <div className="max-w-6xl mx-auto p-4 mt-8">
        <AdSenseAd
          client="ca-pub-XXXXXXXXXXXXXXXX"  // Replace with your AdSense client ID
          slot="1234567890"                // Replace with your AdSense ad slot ID
          style={{ display: "block", textAlign: "center" }}
          className="my-4"
        />
      </div>
    </div>
  );
};

export default MoviePage;
