-- Enums
CREATE TYPE "RoleEnum" AS ENUM ('SUPER_ADMIN', 'COMPANY_OWNER', 'MANAGER', 'DRIVER');
CREATE TYPE "VehicleStatus" AS ENUM ('RUNNING', 'STOPPED', 'OFFLINE');
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FAULTY');
CREATE TYPE "TripStatus" AS ENUM ('ONGOING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "GeofenceType" AS ENUM ('POLYGON', 'CIRCLE');

-- Tables
CREATE TABLE "Company" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT UNIQUE NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "settings" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "email" TEXT UNIQUE NOT NULL,
  "password" TEXT NOT NULL,
  "role" "RoleEnum" NOT NULL DEFAULT 'MANAGER',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Driver" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "licenseNumber" TEXT UNIQUE NOT NULL,
  "contactInfo" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "GpsDevice" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "imei" TEXT UNIQUE NOT NULL,
  "deviceModel" TEXT,
  "simNumber" TEXT,
  "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastSeen" TIMESTAMP,
  "lastLatitude" DOUBLE PRECISION,
  "lastLongitude" DOUBLE PRECISION,
  "lastSpeed" DOUBLE PRECISION,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Vehicle" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "driverId" TEXT REFERENCES "Driver"("id") ON DELETE SET NULL,
  "gpsDeviceId" TEXT UNIQUE REFERENCES "GpsDevice"("id") ON DELETE SET NULL,
  "vehicleNumber" TEXT UNIQUE NOT NULL,
  "type" TEXT,
  "model" TEXT,
  "status" "VehicleStatus" NOT NULL DEFAULT 'OFFLINE',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "VehicleLocation" (
  "id" TEXT PRIMARY KEY,
  "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"("id") ON DELETE CASCADE,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "speed" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "heading" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "altitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "battery" DOUBLE PRECISION,
  "ignitionStatus" BOOLEAN NOT NULL DEFAULT FALSE,
  "timestamp" TIMESTAMP NOT NULL
);

CREATE INDEX "VehicleLocation_vehicleId_timestamp_idx" ON "VehicleLocation"("vehicleId", "timestamp" DESC);

CREATE TABLE "Trip" (
  "id" TEXT PRIMARY KEY,
  "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"("id") ON DELETE CASCADE,
  "startLocation" JSONB,
  "endLocation" JSONB,
  "distance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "duration" INTEGER NOT NULL DEFAULT 0,
  "status" "TripStatus" NOT NULL DEFAULT 'ONGOING',
  "startTime" TIMESTAMP NOT NULL DEFAULT NOW(),
  "endTime" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Alert" (
  "id" TEXT PRIMARY KEY,
  "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Geofence" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "type" "GeofenceType" NOT NULL,
  "coordinates" JSONB NOT NULL,
  "radius" DOUBLE PRECISION,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Notification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Subscription" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "plan" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "ActivityLog" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "companyId" TEXT REFERENCES "Company"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
