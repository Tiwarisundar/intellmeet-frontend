const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: [
        "https://intellmeet-frontend.tiwarisundarm68.workers.dev",
        "http://localhost:5173",
        process.env.CLIENT_URL,
      ].filter(Boolean),
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Authentication
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket Connected:", socket.id);

    // User room
    if (socket.user?.id) {
      socket.join(socket.user.id);
    }

    // Join meeting
    socket.on("join-meeting", (meetingId) => {
      socket.join(meetingId);
      console.log(`${socket.id} joined meeting ${meetingId}`);
    });

    // Leave meeting
    socket.on("leave-meeting", (meetingId) => {
      socket.leave(meetingId);
    });

    // Send message
    socket.on("meeting-message", (data) => {
      io.to(data.meetingId).emit("meeting-message", data);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket Disconnected:", socket.id);
    });
  });

  return io;
}

module.exports = initSocket;