import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app: Application = express();

// Trust proxy for Nginx / Docker reverse proxy
app.set('trust proxy', 1);

// CORS - Restrict to allowed origins (set CORS_ORIGIN in .env for production)
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limiting - Increased to prevent lockout during frequent dashboard telemetry refreshes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // Limit each IP to 3000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Fleet Tracking API is running' });
});

import authRoutes from './routes/auth.routes';
import companyRoutes from './routes/company.routes';
import userRoutes from './routes/user.routes';
import vehicleRoutes from './routes/vehicle.routes';
import driverRoutes from './routes/driver.routes';
import gpsDeviceRoutes from './routes/gpsDevice.routes';
import tripRoutes from './routes/trip.routes';
import geofenceRoutes from './routes/geofence.routes';
import alertRoutes from './routes/alert.routes';
import reportRoutes from './routes/report.routes';
import dashboardRoutes from './routes/dashboard.routes';
import shareRoutes from './routes/share.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import { setupSwagger } from './swagger';

// Swagger docs — only available in development/staging, never in production
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app as any);
}

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/gps-devices', gpsDeviceRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/geofences', geofenceRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/share', shareRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);

export default app;
