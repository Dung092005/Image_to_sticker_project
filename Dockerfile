# StickAI API — Node + Python (Vertex) for Render
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci --omit=dev --workspace server

COPY scripts/requirements.txt ./scripts/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r scripts/requirements.txt

COPY server ./server
COPY scripts ./scripts

ENV NODE_ENV=production
ENV STICKAI_PYTHON=python3
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/server.js"]
