require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const socketService = require("./services/socket.service");
const { sequelize, User ,Notification} = require("./models/index");
const departmentRoutes = require('./routes/department.route');

const app = express();
const server = http.createServer(app); // wrap express in http server

// ── Socket.io setup ─────────────────────────────────────────────────────────

const allowedOrigins = [
  'http://localhost:5173',                    
  process.env.CLIENT_URL,                    
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

// Store io globally so services can access it
socketService.init(io);

// JWT auth on socket handshake — runs before connection event
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "name", "role", "is_active"],
    });

    if (!user || !user.is_active) return next(new Error("Unauthorized"));

    socket.user = user; // attach user to socket
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user.id;

  // Each user joins their own private room — only they receive events
  socket.join(`user_${userId}`);
  console.log(`✓ Socket connected: user_${userId}`);

  // Client can manually mark notification as read via socket
  socket.on("mark_read", async ({ notificationId }) => {
    try {
      await Notification.update(
        { is_read: true },
        { where: { id: notificationId, user_id: userId } },
      );
    } catch (err) {
      console.error("mark_read error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log(`✗ Socket disconnected: user_${userId}`);
  });
});

// ── Express middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",          require("./routes/auth.route"));
app.use(express.urlencoded({ extended: true }));
app.use("/api/expenses",      require("./routes/expense.route"));
app.use("/api/receipt",       require("./routes/receipt.route"));
app.use("/api/notifications", require("./routes/notification.route"));
app.use('/api/budgets',       require('./routes/budget.route'));
app.use('/api/departments', require('./routes/department.route'));
app.use('/api/analytics', require('./routes/analytics.route'));
app.use('/api/export', require('./routes/export.route'));
app.use('/api/admin', require('./routes/admin.route'));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
// Root route — shows API is running
app.get('/', (req, res) => {
  res.json({
    message: '✓ Expense Management API is running',
    version: '1.0.0',
    endpoints: {
      health:        'GET  /api/health',
      auth:          'POST /api/auth/login',
      expenses:      'GET  /api/expenses',
      analytics:     'GET  /api/analytics/summary',
      notifications: 'GET  /api/notifications',
    }
  });
});
// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal server error" });
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// This tells Sequelize to safely alter the tables to match your models
sequelize.authenticate()
  .then(() => {
    console.log("✓ DB synced with new columns");
    server.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("✗ DB failed:", err.message);
  });
