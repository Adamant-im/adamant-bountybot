ADAMANT Bounty Bot is a software that allows you to carry out bounty campaigns & crypto airdrops, with automatic task verifications and payouts. Bounty bots work in ADAMANT Messenger chats directly.

The bot supports payouts in ADM, ETH and ERC-20 tokens.

Read more: [Carry out a crypto Bounty campaign on ADAMANT platform]().

# Installation

## Requirements

* Ubuntu 16 / Ubuntu 18 (other OS had not been tested)
* NodeJS v 8+ (already installed if you have a node on your machine)
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
nano config.json
```

Parameters:

* `passPhrase` <string> The exchange bot's secret phrase for concluding transactions. Obligatory. Bot's ADAMANT address will correspond this passPhrase.
* `node_ADM` <string, array> List of nodes for API work, obligatorily
* `node_ETH` <string, array> List of nodes for Ethereum API work, obligatorily
* `infoservice` <string, array> List of [ADAMANT InfoServices](https://github.com/Adamant-im/adamant-currencyinfo-services) for catching exchange rates, obligatorily
* `socket` <boolean> If to use WebSocket connection. Recommended for better user experience
* `ws_type` <string> Choose socket connection, "ws" or "wss" depending on your server
* `bot_name` <string> Bot's name for notifications
* `slack` <string> Token for Slack alerts for the bot’s administrator. No alerts if not set
* `adamant_notify` <string> ADM address for the bot’s administrator. Recommended
* `known_crypto` <string, array> List of cryptocurrencies bot can work with. Obligatorily
* `erc20` <string, array> List of cryptocurrencies of ERC-20 type. It is necessary to put all known ERC-20 tokens here.

* `twitter_follow` <string, array> List of Twitter account user should follow
* `twitter_retweet` <string, array> List of Twitter posts user should retweet

* `welcome_string` <string> How to reply user in-chat, if first unknown command received
* `help_message` <string> How to reply to */help* command. Recommended to put Bounty rules here

## Launching

You can start the Bot with the `node app` command, but it is recommended to use the process manager for this purpose.

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
