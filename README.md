ADAMANT Bounty Bot is a software that allows you to carry out bounty campaigns & crypto airdrops, with automatic task verification and payouts.

It's made for crypto projects and communities.

The bounty bot:

* Interactive and interesting for users. The bot talks to users in ADAMANT Messenger chat directly.
* Works with Twitter campaigns: follow, retweet & retweet with comment (quote). You can set up mentions and hashtags.
* Set which Twitter accounts are eligible to participate: minimum followers, friends, statuses and lifetime
* Supports ADAMANT campaigns: users will invite other users
* Automatic task verification and payouts
* Supports payouts in ADM, LSK, ETH and ERC-20 tokens
* Easy to install and configure
* Free and open source
* Stores statistics

# Installation

User-friendly instructions: [Carry out a crypto Bounty campaign on ADAMANT platform](https://medium.com/adamant-im/adamants-interactive-bounty-bot-for-cryptocurrency-projects-51fec10f93b9).

## Requirements

* Ubuntu 18, 20, 22 (we didn't test others)
* NodeJS v 14+
* MongoDB ([installation instructions](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/))

## Setup

```
su - adamant
git clone https://github.com/Adamant-im/adamant-bountybot
cd ./adamant-bountybot
npm i
```

## Pre-launch tuning

```
cp config.default.json config.json
nano config.json
```

Parameters: See descriptions in config file.

## Launching

You can start the Bot with the `node app` command, but it's recommended to use the process manager for this purpose.

```
pm2 start --name bountybot app.js
```

## Add the Bot to cron

```
crontab -e
```

Add string:

```
@reboot cd /home/adamant/adamant-bountybot && pm2 start --name bountybot app.js
```

## Updating

```
su - adamant
cd ./adamant-bountybot
pm2 stop bountybot
mv config.json config_bup.json && git pull && mv config_bup.json config.json
npm i
pm2 start --name bountybot app.js
```
