import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Video as VideoIcon, Send, X } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null); // { type, file, url }
  const fileInputRef = useRef(null);
  const { sendMessage, emitTyping, emitStopTyping } = useChatStore();

  // Timer for debounce typing stop
  const typingTimeoutRef = useRef(null);

  // Handle selecting an image or video file
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Please select an image or video file");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview({
      type: file.type.startsWith("video/") ? "video" : "image",
      file,
      url,
    });
  };

  const removePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !preview) return;

    // Build form data: text + optional file
    const formData = new FormData();
    formData.append("text", text.trim());
    if (preview) {
      if (preview.type === "image") {
        formData.append("image", preview.file);
      } else {
        formData.append("video", preview.file);
      }
    }

    try {
      // sendMessage should accept FormData and handle multipart
      await sendMessage(formData);
      setText("");
      removePreview();
      emitStopTyping(); // Emit stop typing on send
      clearTimeout(typingTimeoutRef.current);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  // Handle typing with debounce
  const handleChange = (e) => {
    setText(e.target.value);
    emitTyping();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      emitStopTyping();
    }, 1500); // 1.5 seconds after last keystroke
  };

  return (
    <div className="p-4 w-full">
      {preview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            {preview.type === "image" ? (
              <img
                src={preview.url}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
            ) : (
              <video
                src={preview.url}
                controls
                className="w-32 h-20 object-cover rounded-lg border border-zinc-700"
              />
            )}
            <button
              onClick={removePreview}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            onChange={handleChange}
          />

          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle ${
              preview ? "text-emerald-500" : "text-zinc-400"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Image size={20} />
          </button>
        </div>

        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !preview}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
