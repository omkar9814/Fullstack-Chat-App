import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    sendMessage,
    typingStatus,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    if (selectedUser?._id) {
      getMessages(selectedUser._id);
    }
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [
    selectedUser?._id,
    getMessages,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pass this handler into MessageInput
  const handleSendMessage = (messageData) => {
    sendMessage(messageData);
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    );
  }

  // Determine if selectedUser is typing
  // Show typing indicator if any user is typing to the logged-in user
  const typingUsers = Object.keys(typingStatus).filter(
    (userId) => typingStatus[userId]
  );

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500">No messages yet</div>
        ) : (
          messages.map((message) => (
            <div
              key={message._id}
              className={`chat ${
                message.senderId === authUser._id ? "chat-end" : "chat-start"
              }`}
            >
              <div className="chat-image avatar">
                <div className="w-10 h-10 rounded-full border">
                  <img
                    src={
                      message.senderId === authUser._id
                        ? authUser.profilePic || "/avatar.png"
                        : selectedUser.profilePic || "/avatar.png"
                    }
                    alt="profile pic"
                  />
                </div>
              </div>

              <div className="chat-header mb-1">
                <time className="text-xs opacity-50 ml-1">
                  {formatMessageTime(message.createdAt)}
                </time>
              </div>

              <div className="chat-bubble flex flex-col">
                {message.deleted ? (
                  <p className="italic text-gray-500">This message was deleted</p>
                ) : (
                  <>
                    {message.image && (
                      <div className="relative group">
                        <img
                          src={message.image}
                          alt="Attachment"
                          className="sm:max-w-[200px] rounded-md mb-2"
                        />
                        <a
                          href={message.image}
                          download
                          className="absolute top-1 right-1 bg-black bg-opacity-50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Download Image"
                        >
                          &#8681;
                        </a>
                      </div>
                    )}
                    {message.video && (
                      <div className="relative group">
                        <video
                          src={message.video}
                          controls
                          className="sm:max-w-[200px] rounded-md mb-2"
                        />
                        <a
                          href={message.video}
                          download
                          className="absolute top-1 right-1 bg-black bg-opacity-50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Download Video"
                        >
                          &#8681;
                        </a>
                      </div>
                    )}
                    {message.text && <p>{message.text}</p>}
                    {message.edited && (
                      <span className="text-xs italic text-gray-400">edited</span>
                    )}
                    {/* Reactions */}
                    {message.reactions && Object.keys(message.reactions).length > 0 && (
                      <div className="flex space-x-1 mt-1">
                        {Object.entries(message.reactions).map(([userId, emoji]) => (
                          <span key={userId} className="text-sm">
                            {emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Read receipts */}
              <div className="text-xs text-gray-400 mt-1 ml-auto flex items-center space-x-1">
                {message.readBy && message.readBy.length > 0 && (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{message.readBy.length}</span>
                  </>
                )}
              </div>
            </div>
          ))
        )}
        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="text-sm italic text-gray-500 ml-12 mb-2">
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.length} users are typing...`}
          </div>
        )}
        <div ref={messageEndRef} />
      </div>

      {/* Pass the prop down */}
      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatContainer;
