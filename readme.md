
# KingHub Mining Automation

[![Support the Author](https://img.shields.io/badge/Support-Author-blue)](https://t.me/KingHubSuperApp_Bot/GoApp?startapp=682870229)

**Register**: [Here](https://t.me/KingHubSuperApp_Bot/GoApp?startapp=682870229)  
**Sponsor Code**: `199228075`

This project automates interactions with the KingHub API to manage user accounts, check mining statuses, claim rewards, and upgrade boot levels.

## Features

- **Token Management**: Automatically refreshes and updates access tokens.
- **Mining Status**: Checks mining status, including current points, boost levels, and claim windows.
- **Reward Claims**: Claims mining rewards automatically when available.
- **Boots Upgrade**: Checks if enough points are available to upgrade boots and upgrades to the next level if possible.

## Requirements

- Node.js (version 14 or higher)
- `axios` for making HTTP requests
- `chalk@2` for colorized console output
- File system access to read and update tokens

## Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/ganjsmoke/kinghub.git
   cd kinghub
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Token File**

   Create a file named `hash.txt` in the root of the project directory. This file should contain your access and refresh tokens, separated by commas. Each line represents a different account.

   ```
   accessToken1,refreshToken1
   accessToken2,refreshToken2
   ```

## Usage

Run the script using Node.js:

```bash
node index.js
```

## Author

Bot created by: https://t.me/airdropwithmeh
