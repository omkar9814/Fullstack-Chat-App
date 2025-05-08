import { X, Phone, Video } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import CallModal from "./CallModal";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, startCall, callIncoming, callActive, callOutgoing } = useChatStore();
  const { onlineUsers } = useAuthStore();

  if (!selectedUser && !callIncoming && !callActive && !callOutgoing) {
    return (
      <div className="p-2.5 border-b border-base-300">
        <div className="flex items-center justify-between">
          <div className="text-gray-500">No user selected</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-2.5 border-b border-base-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="avatar">
              <div className="size-10 rounded-full relative">
                <img
                  src={selectedUser?.profilePic || "/avatar.png"}
                  alt={selectedUser?.fullName}
                />
              </div>
            </div>

            {/* User info */}
            <div>
              <h3 className="font-medium">{selectedUser?.fullName}</h3>
              <p className="text-sm text-base-content/70">
                {onlineUsers.includes(selectedUser?._id) ? "Online" : "Offline"}
              </p>
            </div>
          </div>

          {/* Call buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => startCall("audio")}
              title="Start Audio Call"
              className="p-2 rounded hover:bg-gray-200"
            >
              <Phone size={20} />
            </button>
            <button
              onClick={() => startCall("video")}
              title="Start Video Call"
              className="p-2 rounded hover:bg-gray-200"
            >
              <Video size={20} />
            </button>
            {/* Close button */}
            <button onClick={() => setSelectedUser(null)}>
              <X />
            </button>
          </div>
        </div>
      </div>
      <CallModal />
    </>
  );
};

export default ChatHeader;
