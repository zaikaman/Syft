import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
];

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400, // 24 hours
};

export default cors(corsOptions);
