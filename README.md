# Ozon Product Tracker

This is a Node.js application that tracks product prices and availability on Ozon.ru and sends notifications via Telegram.

## Features

-   Tracks product price changes and availability.
-   Sends notifications to Telegram when a product's price drops or its availability changes.
-   Supports multiple users, each with their own favorite product lists.
-   Provides a report with application statistics.

## Prerequisites

-   Node.js (v18 or higher)
-   Yarn package manager
-   A Telegram bot token
-   A Telegram admin chat ID
-   Cookies for ozon.ru

## Setup

1.  Clone the repository:

    ```bash
    git clone <repository-url>
    ```
2.  Install dependencies:

    ```bash
    yarn install
    ```
3.  Create a `.env` file in the root directory and add the following environment variables:

    ```env
    TELEGRAM_BOT_TOKEN=<your_telegram_bot_token>
    TELEGRAM_ADMIN_CHAT_ID=<your_telegram_admin_chat_id>
    ```
4.  Place your ozon.ru cookies in a `.cookies` file in the root directory.

## Usage

1.  Run the application:

    ```bash
    yarn start
    ```
2.  Use the following commands in Telegram to interact with the bot:

    -   `/getid` - Get your chat ID.
    -   `/getall` - Get all products from your favorite list.
    -   `/addlist <ozon_list_url>` - Add a favorite list to track.
    -   `/adduser <chat_id>` - Add a user to the bot (admin only).
    -   `/stop` - Stop tracking products.
    -   `/report` - Get application statistics (admin only).

## Development

-   Use `yarn dev` to start the application in development mode.
-   Use `yarn test` to run tests.
-   Use `yarn build` to build the application.

## Contributing

Feel free to contribute to the project by submitting pull requests.

## License

[MIT](LICENSE)
