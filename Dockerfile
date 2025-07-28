# Base stage: Use Node.js to install deps and build
FROM node:20-alpine AS build

WORKDIR /app

# Copy only necessary files for install/build
COPY package*.json ./
RUN npm install

# Copy rest of the application
COPY . .

# Run build using npm
RUN npm run build

# Final stage: Use Bun to run the dev server
FROM oven/bun:1.1.13 AS final

WORKDIR /app

# Copy the built app and node_modules from the build stage
COPY --from=build /app /app

# Optional: Run bun install if you want Bun to use its own runtime modules
# RUN bun install

EXPOSE 3400

# Start dev server with Bun
CMD ["bun", "run", "dev"]
