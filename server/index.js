import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { UserRouter } from './routes/user.js';
import { AdminRouter } from './routes/admin.js';

dotenv.config();

const DB_CONNECTION_STRING = process.env.DATABASE;
mongoose.connect(DB_CONNECTION_STRING)
  .then(() => console.log('MongoDB connection established'))
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

const app = express();

app.use(express.json());    
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());

app.use('/user', UserRouter);
app.use('/admin', AdminRouter);

const SERVER_PORT = process.env.PORT || 5000;
app.listen(SERVER_PORT, () => console.log(`Server listening on port ${SERVER_PORT}`));
