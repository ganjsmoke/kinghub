const axios = require('axios');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Set the base URL
const BASE_URL = 'https://api.kinghub.io/api/v1';

// Function to read tokens from hash.txt
function readTokens() {
    const tokenFilePath = path.join(__dirname, 'hash.txt');
    try {
        const tokens = fs.readFileSync(tokenFilePath, 'utf-8').trim().split('\n').map(line => {
            const parts = line.split(',');
            const accessToken = parts[0] || null;
            const refreshToken = parts[1] || null;
            const email = parts[2];
            const password = parts[3];

            return { accessToken, refreshToken, email, password };
        });
        return tokens;
    } catch (error) {
        console.error(chalk.red('Error reading hash file:', error));
        return [];
    }
}

// Function to update hash.txt with new tokens
function updateTokens(tokens) {
    const tokenFilePath = path.join(__dirname, 'hash.txt');
    const data = tokens.map(token =>
        `${token.accessToken || ''},${token.refreshToken || ''},${token.email},${token.password}`
    ).join('\n');
    fs.writeFileSync(tokenFilePath, data, 'utf-8');
}

// Function to login and get new tokens
async function login(email, password) {
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email,
            password,
            code: ""
        });

        const { accessToken, refreshToken } = response.data.data;
        console.log(chalk.green(`   • Login successful for ${email}.`));
        return { accessToken, refreshToken };
    } catch (error) {
        console.error(chalk.red(`Error logging in for ${email}:`, error));
        throw error;
    }
}

// Function to refresh the access token
async function refreshToken(tokenData, index) {
    try {
        const response = await axios.post(`${BASE_URL}/auth/refresh-token`, {
            token: tokenData.refreshToken,
        });
        const newAccessToken = response.data.data;
        console.log(chalk.blue(`   • Token refreshed successfully for account ${index + 1}`));

        // Update the token data with the new access token
        tokenData.accessToken = newAccessToken;
        return newAccessToken;
    } catch (error) {
        console.log(chalk.yellow(`   • Refresh token failed for account ${index + 1}. Trying to log in again.`));
        try {
            const newTokens = await login(tokenData.email, tokenData.password);

            // Update token data with new tokens from login
            tokenData.accessToken = newTokens.accessToken;
            tokenData.refreshToken = newTokens.refreshToken;

            return newTokens.accessToken;
        } catch (loginError) {
            console.error(chalk.red(`   • Failed to log in for account ${index + 1}:`, loginError));
            return null;
        }
    }
}

// Function to handle API requests with token refresh fallback
async function requestWithTokenRefresh(fn, tokenData, index, ...args) {
    try {
        return await fn(tokenData.accessToken, ...args);
    } catch (error) {
        if (error.response && error.response.status === 401) { // Token expired
            console.log(chalk.yellow(`   • Access token expired for account ${index + 1}. Refreshing...`));
            const newToken = await refreshToken(tokenData, index);
            if (newToken) {
                updateTokens(readTokens());
                return fn(newToken, ...args);
            } else {
                throw new Error(`   • Failed to refresh token for account ${index + 1}`);
            }
        } else {
            throw error;
        }
    }
}

// Function to get user details and return the email
async function getUserDetails(accessToken) {
    const response = await axios.get(`${BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data.data.email;
}

// Function to get mining info, return timeEndMining in local time, levelBoots, and point
async function miningInfo(accessToken) {
    const response = await axios.get(`${BASE_URL}/user-mining/info`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { timeEndMining, levelBoots, point } = response.data.data;

    // Convert timeEndMining to local time
    const localTimeEndMining = new Date(timeEndMining * 1000).toLocaleString();
    return { timeEndMining, localTimeEndMining, levelBoots, point };
}

// Function to claim mining reward and print success message
async function claimMining(accessToken) {
    const response = await axios.get(`${BASE_URL}/user-mining/claim`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const reward = Math.round(response.data.data); // Round up the reward
    console.log(chalk.green(`   • Claim Success! Reward: ${reward}`));
}

// Function to upgrade boots level if possible
async function upgradeBootsLevel(accessToken, currentBootLevel, currentPoints) {
    const maxBootLevel = 5;

    if (currentBootLevel >= maxBootLevel) {
        console.log(chalk.red('   • You are already at the maximum boot level.'));
        return;
    }

    try {
        const response = await axios.get(`${BASE_URL}/public/config/boots`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const bootsConfig = response.data.data;
        const nextBoot = bootsConfig.find(boot => boot.level === currentBootLevel + 1);

        if (nextBoot && currentPoints >= nextBoot.pointRequire) {
            const upgradeResponse = await axios.get(`${BASE_URL}/user-mining/boots/${nextBoot.level}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (upgradeResponse.data.data === true && upgradeResponse.data.status === 'success') {
                console.log(chalk.green(`   • Successfully upgraded to boot level ${nextBoot.level}!`));
            } else {
                console.log(chalk.red(`   • Failed to upgrade to boot level ${nextBoot.level}.`));
            }
        } else {
            console.log(chalk.yellow(`   • Not enough points to upgrade to level ${currentBootLevel + 1}.`));
        }
    } catch (error) {
        console.error(chalk.red('Error checking or upgrading boot level:', error));
    }
}

function printHeader() {
    const line = "=".repeat(50);
    const title = "Auto Claim & Upgrade Kinghub";
    const createdBy = "Bot created by: https://t.me/airdropwithmeh";

    const totalWidth = 50;
    const titlePadding = Math.floor((totalWidth - title.length) / 2);
    const createdByPadding = Math.floor((totalWidth - createdBy.length) / 2);

    const centeredTitle = title.padStart(titlePadding + title.length).padEnd(totalWidth);
    const centeredCreatedBy = createdBy.padStart(createdByPadding + createdBy.length).padEnd(totalWidth);

    console.log(chalk.cyan.bold(line));
    console.log(chalk.cyan.bold(centeredTitle));
    console.log(chalk.green(centeredCreatedBy));
    console.log(chalk.cyan.bold(line));
}

// Main function to process accounts
async function processAccounts() {
    printHeader();
    const tokenDataList = readTokens();
    let shortestWaitTime = Infinity;

    if (tokenDataList.length === 0) {
        console.log(chalk.red('No tokens found in hash.txt.'));
        return;
    }

    for (let i = 0; i < tokenDataList.length; i++) {
        const tokenData = tokenDataList[i];
        console.log(`\n${chalk.bold.blue(`Processing Account ${i + 1}:`)}`);

        try {
            // If tokens are missing, perform login
            if (!tokenData.accessToken || !tokenData.refreshToken) {
                console.log(chalk.yellow(`   • Missing tokens for account ${i + 1}. Logging in...`));
                const newTokens = await login(tokenData.email, tokenData.password);
                tokenData.accessToken = newTokens.accessToken;
                tokenData.refreshToken = newTokens.refreshToken;

                // Save the updated tokens to hash.txt
                updateTokens(tokenDataList);
            }

            const email = await requestWithTokenRefresh(getUserDetails, tokenData, i);

            const miningData = await requestWithTokenRefresh(miningInfo, tokenData, i);
            if (!miningData) continue;

            const { timeEndMining, localTimeEndMining, levelBoots, point } = miningData;

            console.log(`${chalk.bold("   Email:")} ${chalk.cyan(email)}`);
            console.log(`${chalk.bold("   Boost Level:")} ${chalk.cyan(levelBoots)}`);
            console.log(`${chalk.bold("   Points:")} ${chalk.cyan(point)}`);
            console.log(`${chalk.bold("   Next Claim Time:")} ${chalk.cyan(localTimeEndMining)}`);

            await requestWithTokenRefresh(upgradeBootsLevel, tokenData, i, levelBoots, point);

            if (timeEndMining <= Math.floor(Date.now() / 1000)) {
                console.log(chalk.yellow("   • It's time to claim rewards."));
                await requestWithTokenRefresh(claimMining, tokenData, i);
            } else {
                console.log(chalk.green("   • Next claim time has not yet arrived."));
                const waitTime = (timeEndMining - Math.floor(Date.now() / 1000)) * 1000;
                shortestWaitTime = Math.min(shortestWaitTime, waitTime);
            }
        } catch (error) {
            console.error(chalk.red(`Error processing account ${i + 1}:`), error);
        }
    }

    updateTokens(tokenDataList);

    return shortestWaitTime;
}

// Infinite loop to process accounts
(async function loopProcessAccounts() {
    while (true) {
        const waitTime = await processAccounts();
        if (waitTime && waitTime !== Infinity) {
            let remainingTime = waitTime;
            console.log(`\n${chalk.bold("Waiting until the next claim window...")}`);

            while (remainingTime > 0) {
                process.stdout.write(chalk.yellow(`\rCountdown: ${Math.floor(remainingTime / 1000)} seconds remaining...`));
                await new Promise(resolve => setTimeout(resolve, 1000));
                remainingTime -= 1000;
            }
            console.log(chalk.green("\nCountdown complete. Rechecking claims...\n"));
        } else {
            console.log(chalk.red("No upcoming claims or unable to calculate wait time. Retrying shortly...\n"));
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
    }
})();
