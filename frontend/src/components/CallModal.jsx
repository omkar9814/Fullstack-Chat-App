import React from "react";
import { Phone, Video, X, Check } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const CallModal = () => {
  const {
    callIncoming,
    callActive,
    callType,
    answerCall,
    endCall,
    callOutgoing,
    getCallDisplayInfo,
  } = useChatStore();

  if (!callIncoming && !callActive && !callOutgoing) {
    return null;
  }

  const user = getCallDisplayInfo();

  const callLabel = callType === "video" ? "Video Call" : "Audio Call";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-w-full flex flex-col items-center">
        <div className="mb-4">
          <img
            src={user?.image || "/avatar.png"}
            alt={user?.name || "User"}
            className="w-24 h-24 rounded-full object-cover mx-auto"
          />
        </div>
        <h2 className="text-xl font-semibold mb-1 text-center">
          {user?.name || "Unknown User"}
        </h2>
        <p className="text-gray-600 mb-6 text-center">{callLabel}</p>

        {callIncoming && (
          <div className="flex space-x-6">
            <button
              onClick={answerCall}
              className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-md flex items-center justify-center"
              title="Answer Call"
            >
              <Check size={24} />
            </button>
            <button
              onClick={endCall}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-md flex items-center justify-center"
              title="Reject Call"
            >
              <X size={24} />
            </button>
          </div>
        )}

        {callActive && (
          <div className="flex space-x-6">
            <button
              onClick={endCall}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-md flex items-center justify-center"
              title="End Call"
            >
              <X size={24} />
            </button>
          </div>
        )}

        {callOutgoing && !callActive && !callIncoming && (
          <div className="flex space-x-6">
            <button
              onClick={endCall}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-md flex items-center justify-center"
              title="Cancel Call"
            >
              <X size={24} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallModal;
