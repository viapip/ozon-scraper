# Ozon Tracker

A robust TypeScript application for monitoring product prices and availability on Ozon.ru, featuring Telegram notifications for price drops and availability changes.

## Features

- 🔍 Automated tracking of product prices and availability
- 📊 Historical price analytics and trends
- 🤖 Intuitive Telegram bot interface
- 👥 Multi-user support with individual tracking lists
- 📈 Performance metrics and reporting
- 🛡️ Anti-detection mechanisms for reliable data collection
- 🔄 Configurable scheduled checks

## Architecture

The application follows a clean, modular architecture with clear separation of concerns:

```
src/
├── api/                   # External service integrations
│   ├── ozon/              # Ozon.ru scraping implementation
│   └── telegram/          # Telegram bot implementation
├── config/                # Application configuration
├── domain/                # Core business logic
│   ├── products/          # Product management
│   ├── analytics/         # Price analytics
│   └── users/             # User management
├── infrastructure/        # Technical infrastructure
│   ├── scheduler/         # Task scheduling
│   └── storage/           # Data persistence
├── utils/                 # Shared utilities
├── types/                 # TypeScript type definitions
├── app.ts                 # Application initialization
└── index.ts              # Entry point
```

## Requirements

- Node.js (v18+)
- Yarn package manager
- Telegram bot token (obtain from [@BotFather](https://t.me/botfather))
- Telegram user ID for admin access
- Ozon.ru cookies (for authentication)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ozon-tracker.git
cd ozon-tracker
```

2. Install dependencies:

```bash
yarn install
```

3. Create a `.env` file with the following configuration:

```env
# Required
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_telegram_chat_id

# Optional (with defaults)
SCHEDULER_CHECK_INTERVAL=30  # check interval in minutes
LOG_LEVEL=info               # logging level (debug, info, warn, error)
DATABASE_PATH=./db           # LevelDB database location
OZON_HEADLESS=true           # run browser in headless mode
```

4. Create a `.cookies` file containing your Ozon.ru cookies in standard format
   - Use the provided `.cookies.example` file as a template: copy it to `.cookies` and replace the example cookies with your own

### Cookie Management Best Practices

- **Use Private/Incognito Mode**: Log in to Ozon.ru using private/incognito browsing mode to prevent session conflicts between the bot and your regular browsing sessions. This prevents Ozon from invalidating the bot's cookies when you log in from another device.
- **Extract Cookies Carefully**: After logging in, extract the cookies from your browser's developer tools and save them to the `.cookies` file.
- **Regular Updates**: Periodically update the cookies file if you notice tracking issues or authentication problems.

### Why Cookies Are Required

1. **Personalized Pricing**: Ozon.ru may show different prices to different users or to non-authenticated visitors. Using your account's cookies ensures the bot sees the same prices you would see.
2. **Wishlists Access**: The application tracks products through Ozon's wishlists feature, which requires authentication.
3. **Anti-Bot Protection**: Ozon implements anti-scraping measures that are more permissive with authenticated sessions.

## Running the Application

### Production

```bash
yarn build  # Build the application
yarn start  # Start the application
```

### Development

```bash
yarn dev    # Run with automatic restarting
```

### Docker

```bash
docker-compose up -d  # Run with Docker Compose
```

## Telegram Bot Commands

- `/start` - Initialize the bot and get basic information
- `/getid` - Get your Telegram chat ID
- `/activate <chat_id>` - Activate a user (admin only)
- `/addlist <ozon_list_url>` - Add an Ozon wishlist for tracking
- `/getall` - Show all currently tracked products
- `/stop` - Stop tracking and deactivate your account
- `/report` - Get application performance statistics (admin only)

## How It Works

1. **Authentication**: The application uses provided cookies to authenticate with Ozon.ru
2. **Data Collection**: At scheduled intervals, the application scrapes product information from user wishlists
3. **Analysis**: Price and availability changes are detected by comparing with historical data
4. **Notification**: When significant changes are detected (price drops or availability changes), users receive Telegram notifications
5. **Storage**: All price history is stored in LevelDB for efficient retrieval and analysis

## Technical Implementation

- **TypeScript** for type safety and maintainability
- **Playwright** for reliable browser automation with anti-detection techniques
- **LevelDB** for efficient, persistent data storage
- **Telegraf** for Telegram API integration
- **Node.js** scheduler for reliable task execution

## Best Practices

- **Error Handling**: Comprehensive error catching and logging
- **Modular Design**: Clear separation of concerns with domain-driven design
- **Anti-Detection**: Advanced browser fingerprint spoofing to prevent blocking
- **Resource Management**: Proper cleanup of browser resources
- **Performance Optimization**: Batched notifications and efficient data storage
- **Configurability**: Environment-based configuration for flexible deployment

## Development Guidelines

- Follow the existing code style and architecture
- Ensure proper error handling in all async operations
- Use the logger for all significant events
- Keep dependencies updated to maintain security
- Add tests for new functionality

## License

MIT
