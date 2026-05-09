ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION}
WORKDIR /app
COPY package.json ./
COPY gateway.js ./
COPY policies/ ./policies/
RUN mkdir -p .classroom-cache
EXPOSE 7070
CMD ["node", "gateway.js"]
