FROM node:20-slim

# Install system dependencies for OpenShell/OpenClaw
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Expose the gateway port
EXPOSE 7070

# Default environment variables
ENV NODE_ENV=production
ENV INICLAW_PORT=7070

CMD ["npm", "run", "start:gateway"]
