# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose ports
EXPOSE 3000
EXPOSE 4000

# Start the application
CMD ["npm", "start"]
