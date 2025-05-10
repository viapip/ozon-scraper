# Ozon Scraper

A tool for monitoring product prices and availability on Ozon.ru with Telegram notifications.

## Features

- 🔍 Track product price changes and availability
- 📊 Historical price analytics
- 🤖 Telegram bot interface for easy management
- 👥 Multi-user support with individual tracking lists
- 📋 Application performance reporting
- 🔄 Scheduled automatic checks

## Architecture

The application is built on a modular architecture:

```
src/
├── api/                       # API interfaces for external services
│   ├── ozon/                  # Ozon web scraping module
│   └── telegram/              # Telegram messaging module
├── config/                    # Application configuration
├── domain/                    # Business logic
│   ├── products/              # Products module
│   ├── analytics/             # Analytics module
│   └── users/                 # Users module
├── infrastructure/            # Infrastructure code
│   ├── scheduler/             # Scheduler module
│   ├── storage/               # Storage module
│   └── logger/                # Logging module
├── utils/                     # Utilities
├── types/                     # Common types
├── app.ts                     # Application initialization
└── index.ts                   # Entry point
```

## Requirements

- Node.js (v18 or higher)
- Yarn package manager
- Telegram bot token
- Telegram admin chat ID
- Ozon.ru cookies

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ozon-scraper.git
cd ozon-scraper
```

2. Install dependencies:

```bash
yarn install
```

3. Create a `.env` file in the root directory with the following variables:

```env
# Required parameters
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_telegram_admin_chat_id

# Optional parameters
SCHEDULER_CHECK_INTERVAL=30  # check interval in minutes
LOG_LEVEL=info               # logging level (debug, info, warn, error)
DATABASE_PATH=./db           # database path
```

4. Create a `.cookies` file in the root directory with your Ozon.ru cookies

## Running the Application

1. Start the application:

```bash
yarn start
```

2. For development:

```bash
yarn dev
```

## Telegram Bot Commands

- `/start` - Initialize the bot and get your ID
- `/getid` - Get your chat ID
- `/activate <chat_id>` - Activate a user (admin only)
- `/addlist <ozon_list_url>` - Add a wishlist for tracking
- `/getall` - Show all tracked products
- `/stop` - Stop tracking products
- `/report` - Get application statistics (admin only)

## How It Works

1. User adds a public Ozon wishlist URL
2. The system periodically checks for price and availability changes
3. When changes are detected (price drops, availability changes), notifications are sent
4. All price history is stored for later analysis

## Technology Stack

- TypeScript for type safety and code reliability
- LevelDB for data storage
- Playwright for browser automation
- Telegraf for Telegram API integration

## Key Features

- Anti-detection techniques to bypass Ozon protections
- Modular architecture for easy extension
- Efficient price history storage
- Support for multiple users with different product lists
