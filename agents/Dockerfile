FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Create logs directory
RUN mkdir -p /app/logs

# Set default environment variables
ENV NODE_ENV=production
ENV AGENT_NAME=Agent
ENV MINECRAFT_HOST=minecraft-server
ENV MINECRAFT_PORT=25565
ENV OLLAMA_HOST=http://ollama:11434
ENV LLM_MODEL=llama3.1:8b
# Memory settings: 512MB heap with exposed GC
ENV NODE_OPTIONS="--max-old-space-size=512 --expose-gc"

# Run the agent
CMD ["node", "src/index.js"]
