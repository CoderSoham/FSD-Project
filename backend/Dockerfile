# Kept so this is not tied to one host. Railway, Fly and any container platform
# take this as is; Render uses render.yaml and does not need it.
FROM node:20-alpine

WORKDIR /app

# Copy manifests first so a dependency install is only redone when they change.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Documentation only. The platform sets PORT and server.js reads it.
EXPOSE 5002

# server.js binds 0.0.0.0 by default, which is what a container needs.
CMD ["node", "server.js"]
