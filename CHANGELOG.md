# Changelog

## v0.0.4

[compare changes](https://undefined/undefined/compare/v0.0.3...v0.0.4)

### 🚀 Enhancements

- **telegram:** Add /setthreshold command to set notification threshold (94b4d23)

### 🩹 Fixes

- **typescript:** Correct path alias configuration for tests (048c2d8)

### 💅 Refactors

- **ozon/parser): improve out-of-stock detection logic feat(analytics/service): add detection for products that were never in stock feat(analytics/service): add detection for products that came back in stock refactor(analytics/service): exclude zero prices from min/max/median calculations feat(telegram/formatter): enhance message formatting with new status indicators feat(telegram/formatter): add special message for products that were never in stock feat(telegram/formatter): add special message for products that came back in stock refactor(formatting): add formatPriceOrStatus utility for conditional price/status display test(ozon/parser): add tests for new out-of-stock detection logic test(analytics/service): add tests for new never-in-stock and came-back-in-stock detection test(analytics/service): add tests for excluding zero prices from calculations test(formatting:** Add tests for formatPriceOrStatus utility (c694684)

### ✅ Tests

- **ozonParser:** Mock goto method to return null to match puppeteer behavior (5d11808)

### ❤️ Contributors

- Aleksandr <starcev.sash@gmail.com>

## v0.0.3

[compare changes](https://undefined/undefined/compare/v0.0.2...v0.0.3)

### 🏡 Chore

- Update gitignore to ignore all files in .claude directory docs: update README with detailed information about Ozon Tracker build: update docker-compose to use latest image tag (21c9ade)

### ❤️ Contributors

- Aleksandr <starcev.sash@gmail.com>

## v0.0.2

[compare changes](https://undefined/undefined/compare/v0.0.1...v0.0.2)

### 💅 Refactors

- **docker-build.yml): dynamically set image name based on package.json name fix(package.json:** Rename package from ozon-scraper to ozon-tracker (ffe7ea1)

### ❤️ Contributors

- Aleksandr <starcev.sash@gmail.com>

## v0.0.1


### 🚀 Enhancements

- **index.ts): add user management features to the bot service for better user interaction and product tracking refactor(index.ts): rename chatIds to adminChatId for clarity and update validation logic accordingly feat(BotService.ts): implement user existence check and command handling for adding users and managing favorite lists fix(BotService.ts:** Update sendAnalytics method to send messages to specific users instead of a predefined list (c3864c6)
- **.gitignore): update test-product.json entry to use wildcard for flexibility in ignoring test files feat(index.ts): modify user creation logic to check for existing admin user before creating a new one feat(index.ts): update getProducts method to accept chatId and fetch user-specific products feat(index.ts): add setActive method to manage user active status feat(BotService.ts): rename bot commands for clarity and update logic to handle user activation and product retrieval feat(ProductService.ts): implement getProductsByIds method to fetch products based on user product IDs feat(UserService.ts): add methods to update user products and manage user active status refactor(AnalyticsService.ts): adjust price change calculation to improve accuracy and logging refactor(types/index.ts:** Remove unused UserProduct interface and add products array to User interface for better user management (19a467c)
- Refactor OzonService to handle favorite list URLs and IDs more effectively (b83baf0)
- **analytics): enhance product analytics to track availability changes and log product details fix(bot): remove unnecessary checks for analytics data before sending messages fix(ozon): update product price parsing logic to handle unavailable products correctly refactor(index): improve error handling in main function and ensure cleanup is called only if services are initialized feat(types): extend Product and ProductAnalytics interfaces to include inStock status and availability flags chore(helpers:** Add utility function to check product availability based on price (6a40fac)
- **report): add ReportService to track application statistics and provide reports feat(bot): implement '/report' command to allow users to retrieve application statistics fix(ozon): ensure cookies are saved with proper domain and security settings fix(product): include inStock status in product tracking for better reporting refactor(index): integrate ReportService into application services for enhanced monitoring refactor(ozon:** Improve cookie handling and logging for better debugging and maintenance (baa2225)
- **Dockerfile): update comments from Russian to English for better clarity and maintainability feat(index.ts): add scheduler configuration to AppConfig to allow dynamic check interval via environment variable refactor(index.ts): pass check interval from config to SchedulerService constructor for improved flexibility refactor(SchedulerService.ts:** Modify SchedulerService constructor to accept baseInterval parameter for dynamic scheduling (e444b43)
- Implement core application services and structure (78591e4)
- Add GitHub Actions workflows for Docker build and release (5b73bde)

### 🩹 Fixes

- **AnalyticsService): update logging to use the current product instead of the previous price for better clarity refactor(OzonService): extract access restriction handling into a separate method for improved readability and maintainability refactor(OzonService): enhance product extraction logic to ensure accurate price retrieval from multiple elements refactor(OzonService:** Modify smooth scrolling logic to check for footer visibility, improving scrolling efficiency and user experience (2be46e4)
- **index.ts:** Uncomment ozonService initialization to ensure proper service setup before processing products (3543788)
- **ozon): update selectors for product extraction and waiting for content fix(ozon:** Update currency symbol and "Similar" text for price parsing (682cc2a)

### 💅 Refactors

- **index.ts): comment out unused import of test-product.json to clean up code refactor(index.ts): extract URL generation logic into getUrlList function for better readability fix(index.ts): ensure ozonService.close() is called correctly to prevent resource leaks refactor(index.ts): update getProducts method to accept favoriteListUrl instead of favoriteListId for clarity fix(OzonService.ts:** Change browser launch to headless: false for easier debugging during development (1ed3db6)
- **index.ts): rename isUserExists to canActivate for better clarity on user status checks fix(index.ts): uncomment user creation and activation logic for admin user feat(index.ts): add user activation check and logging for inactive users feat(BotService.ts): implement user activation command and welcome message for new users fix(BotService.ts): update command responses to Russian for better localization fix(OzonService.ts:** Add logging for OzonService closure to improve traceability (6de4523)
- **Dockerfile): update base image to node:20-bookworm feat(Dockerfile): add missing Playwright dependencies fix(Dockerfile): install Playwright and browser with dependencies feat(docker-compose.yml): add docker-compose file for easier deployment refactor(index.ts:** Comment out test product import (13f29db)
- Restructure project into domain, infrastructure, and api layers (c07c0cf)
- **telegram): remove unused private property in TelegramCommandHandler fix(telegram): translate user-facing messages to Russian refactor(telegram): pass context to sendProductAnalytics to remove method injection fix(formatting:** Use correct ruble symbol (d4013d4)
- Reorder imports to follow a consistent pattern (b1c30a5)
- **scheduler:** Export SchedulerOptions as type to improve clarity (cc7d0d8)
- **browser-helpers): move cookie parsing and file handling to browser-helpers refactor(app): import readCookiesFromFile from browser-helpers refactor(ozon/browser): import parseCookieString from browser-helpers feat(ozon/browser:** Enable headless mode for chromium browser launch (d5a766c)
- **ozon/browser.ts): comment out headless mode for debugging refactor(utils/formatting.ts:** Simplify URL validation using regex (843bf5a)
- **telegram): move bot logic to TelegramService and CommandHandler feat(telegram:** Add activation check middleware for commands (da74084)

### 📖 Documentation

- **README.md): update project title and add detailed description and usage instructions for the Ozon Product Tracker application refactor(index.ts): remove unused favoriteListUrl from AppConfig and improve error handling for required environment variables fix(AnalyticsService.ts): address infinite price change issue when product is unavailable and improve min price calculation logic style(BotService.ts:** Remove commented-out code for better readability (a822275)

### 📦 Build

- Update dependencies to their latest versions (a5d397f)
- Update dependencies and fix import paths (33734e1)
- **docker-compose): update image tag to 0.0.1 build(package.json): update package.json to use cjs as main export build(package.json): add playwright, consola, and dotenv to dependencies refactor(ozon/browser:** Update access restricted check to use english string (97854f4)

### 🏡 Chore

- Remove improvements.md file feat(utils): add formatPrice helper function refactor(app): use definite assignment assertion for service properties (cb3605b)

### ❤️ Contributors

- Aleksandr <starcev.sash@gmail.com>
- Alec <starcev.sash@gmail.com>

## ...master
