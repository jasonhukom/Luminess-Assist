# ========================================================
# Stage 1: Build React Frontend Assets with Node 22
# ========================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /build

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .
RUN npm run build

# ========================================================
# Stage 2: Django Python Application Server
# ========================================================
FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Install system dependencies (curl for healthcheck, libpq for PostgreSQL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Django source files
COPY . .

# Copy compiled frontend assets from Stage 1
COPY --from=frontend-builder /build/dist ./dist
COPY --from=frontend-builder /build/dist/index.html ./templates/index.html

# Run collectstatic for WhiteNoise
RUN python manage.py collectstatic --noinput

# Set permissions for entrypoint script
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
