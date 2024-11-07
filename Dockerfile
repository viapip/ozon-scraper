# Dependencies stage
FROM node:20-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y \
    g++ \
    python3 \
    make \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare yarn@4.5.1 --activate

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

RUN yarn install --frozen-lockfile

# Builder stage
FROM node:20-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN yarn build

# Final stage
FROM node:20-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    # Системные зависимости
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    # Графические библиотеки
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    # Дополнительные библиотеки для Playwright
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libasound2 \
    libcups2 \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/* /tmp/* \
    && corepack enable \
    && corepack prepare yarn@4.5.1 --activate

# Copy application files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/yarn.lock /app/.yarnrc.yml ./
COPY --from=builder /app/.yarn ./.yarn
COPY --from=builder /app/.cookies.example ./.cookies.example

# Install production dependencies and Playwright
RUN yarn workspaces focus --production \
    && npx playwright install chromium

ENV NODE_ENV=production

CMD ["yarn", "start"]