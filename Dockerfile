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
FROM node:20-bookworm

WORKDIR /app

# Install system dependencies and Playwright dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    # system dependencies
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    # graphic libraries
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    # additional libraries for playwright
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libasound2 \
    libcups2 \
    # Missing Playwright Dependencies
    libx11-xcb1 \
    libxcursor1 \
    libgtk-3-0 \
    libcairo-gobject2 \
    libgdk-pixbuf2.0-0 \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/* /tmp/* \
    && corepack enable \
    && corepack prepare yarn@4.5.1 --activate

# Copy application files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/yarn.lock /app/.yarnrc.yml ./
COPY --from=builder /app/.yarn ./.yarn
COPY --from=builder /app/.cookies.example ./.cookies.example

# Install production dependencies
RUN yarn workspaces focus --production

RUN yarn add playwright
# Install Playwright and browser
RUN yarn playwright install --with-deps chromium

ENV NODE_ENV=production

CMD ["yarn", "start"]