const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const path = require("path");

const socketServer = require("./socketServer");
const authRoutes = require("./routes/authRoutes");
const friendInvitationRoutes = require("./routes/friendInvitationRoutes");
const fileRoutes = require("./routes/fileRoutes");
const codeRoutes = require("./routes/codeRoutes");

const PORT = process.env.PORT || process.env.API_PORT || 5002;

const app = express();
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true, 
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.use("/api/auth", authRoutes);
app.use("/api/friend-invitation", friendInvitationRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/code", codeRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const server = http.createServer(app);
socketServer.registerSocketServer(server);

mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/your-database-name", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Server is listening on ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("Database connection failed. Server not started");
    console.error(err);
  });

module.exports = (req, res) => {
  app(req, res);
};
