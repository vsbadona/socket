import express from 'express';
import cors from "cors"
import { Server } from 'socket.io';
import { createServer } from 'http';
import mongoose from 'mongoose';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // allow requests from any origin
    credentials: true, // allow credentials (e.g. cookies) to be sent
  },
});

app.use(express.static('public'));
app.use(cors({
  origin: '*', // allow requests from any origin
  credentials: true, // allow credentials (e.g. cookies) to be sent
}));

let users = [];

mongoose.connect('mongodb+srv://Vishal123:Vishal123@cluster0.hwzrbs5.mongodb.net/doda?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
const MessageModel = mongoose.model('Message', {
  text: String,
  userId: String,
  targetUserId: String,
});

db.on('error', (error) => {
  console.error(error);
});

db.once('open', () => {
  console.log('Connected to MongoDB');

  // Create a change stream to monitor the Message collection
  const changeStream = MessageModel.watch();

  changeStream.on('change', (change) => {
    console.log('Change detected:', change);

    // Check if the change is an insert operation
    if (change.operationType === 'insert') {
      const message = change.fullDocument;
      const targetUserId = message.targetUserId;

      // Find the target user's socket ID
      const targetUser = users.find((user) => user.userId === targetUserId);
      if (targetUser) {
        // Send a notification to the target user's socket
        io.to(`room-${targetUserId}`).emit('newMessage', message.text);
      }
    }
  });
});

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('newUser', (userId) => {
    users.push({ userId, socketId: socket.id });
    socket.join(`room-${userId}`);
  });

  socket.on('connectToUser', (targetUserId) => {
    const targetUser = users.find((user) => user.userId === targetUserId);
    if (targetUser) {
      socket.join(`room-${targetUserId}`);
    }
  });

  socket.on('sendMessage', (message, targetUserId) => {
    const targetUser = users.find((user) => user.userId === targetUserId);
    if (targetUser) {
      io.to(`room-${targetUserId}`).emit('newMessage', message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    users = users.filter((user) => user.socketId !== socket.id);
  });
});

server.listen(3001, () => {
  console.log('Server listening on port 3001');
});