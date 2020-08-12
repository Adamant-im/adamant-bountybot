const api = require('../../modules/api');
const config = require('../../modules/configReader');
const eth_utils = require('./eth_utils');
const adm_utils = require('./adm_utils');
const log = require('../log');
const db = require('../../modules/DB');
const Store = require('../../modules/Store');

module.exports = {
	unix() {
		return new Date().getTime();
	},
	sendAdmMsg(address, msg, type = 'message') {
		if (msg && !config.isDev || true) {
			try {
				return api.send(config.passPhrase, address, msg, type).success || false;
			} catch (e) {
				return false;
			}
		}
	},
	thousandSeparator(num, doBold) {
		var parts = (num + '').split('.'),
			main = parts[0],
			len = main.length,
			output = '',
			i = len - 1;

		while (i >= 0) {
			output = main.charAt(i) + output;
			if ((len - i) % 3 === 0 && i > 0) {
				output = ' ' + output;
			}
			--i;
		}

		if (parts.length > 1) {
			if (doBold) {
				output = `**${output}**.${parts[1]}`;
			} else {
				output = `${output}.${parts[1]}`;
			}
		}
		return output;
	},
	async getAddressCryptoFromAdmAddressADM(coin, admAddress) {
		try {
			if (this.isERC20(coin)) {
				coin = 'ETH';
			}
			const resp = await api.syncGet(`/api/states/get?senderId=${admAddress}&key=${coin.toLowerCase()}:address`);
			if (resp && resp.success) {
				if (resp.transactions.length) {
					return resp.transactions[0].asset.state.value;
				} else {
					return 'none';
				};
			};
		} catch (e) {
			log.error(' in getAddressCryptoFromAdmAddressADM(): ' + e);
			return null;
		}
	},
	async userDailyValue(senderId) {
		return (await db.paymentsDb.find({
			transactionIsValid: true,
			senderId: senderId,
			needToSendBack: false,
			inAmountMessageUsd: {$ne: null},
			date: {$gt: (this.unix() - 24 * 3600 * 1000)} // last 24h
		})).reduce((r, c) => {
			return +r + +c.inAmountMessageUsd;
		}, 0);
	},
	async updateAllBalances() {
		try {
			await this.ETH.updateBalance();
			await this.ADM.updateBalance();
			for (const t of config.erc20){
				await this[t].updateBalance();
			}
		} catch (e){}
	},
	async getLastBlocksNumbers() {
		const data = {
			ETH: await this.ETH.getLastBlockNumber(),
			ADM: await this.ADM.getLastBlockNumber(),
		};
		for (const t of config.erc20) { 
			// data[t] = await this[t].getLastBlockNumber(); // Don't do unnecessary requests
			data[t] = data['ETH'];
		}
		return data;
	},
	isKnown(coin) {
		return config.known_crypto.includes(coin);
	},
	isAccepted(coin) {
		return config.accepted_crypto.includes(coin);
	},
	isExchanged(coin) {
		return config.exchange_crypto.includes(coin);
	},
	isFiat(coin) {
		return ['USD', 'RUB', 'EUR', 'CNY', 'JPY'].includes(coin);
	},
	isHasTicker(coin) { // if coin has ticker like COIN/OTHERCOIN or OTHERCOIN/COIN
		const pairs = Object.keys(Store.currencies).toString();
		return pairs.includes(',' + coin + '/') || pairs.includes('/' + coin);
	},
	isERC20(coin) {
		return config.erc20.includes(coin.toUpperCase());
	},
	isArraysEqual(array1, array2) {
		return array1.length === array2.length && array1.sort().every(function(value, index) { return value === array2.sort()[index]});
	},
	getAccounts(message) {
		let userAccounts = {};
		userAccounts.notEmpty = false;
		
		userAccounts.twitterLink = this.findLink(message, 'twitter.com');
		if (userAccounts.twitterLink)
			userAccounts.twitterAccount = this.parseTwitterAccountFromLink(userAccounts.twitterLink);
		else
			userAccounts.twitterAccount = this.findTwitterAccount(message);
		
		userAccounts.facebookLink = this.findLink(message, 'facebook.com');

		if (userAccounts.twitterAccount && config.isTwitterCampaign)
			userAccounts.notEmpty = true;
		if (userAccounts.facebookAccount && config.isFacebookCampaign)
			userAccounts.notEmpty = true;
		return userAccounts;
	},
	findTwitterAccount(message) {
		let pattern = /(?<=^|(?<=[^a-zA-Z0-9-_\.]))@([A-Za-z]+[A-Za-z0-9-_]+)/gi;
		let accounts = message.match(pattern);
		if (accounts)
			return accounts[0];
	},
	findLink(message, link) {
		let kLINK_DETECTION_REGEX = /(([a-z]+:\/\/)?(([a-z0-9\-]+\.)+([a-z]{2}|aero|arpa|biz|com|coop|edu|gov|info|int|jobs|mil|museum|name|nato|net|org|pro|travel|local|internal))(:[0-9]{1,5})?(\/[a-z0-9_\-\.~]+)*(\/([a-z0-9_\-\.]*)(\?[a-z0-9+_\-\.%=&amp;]*)?)?(#[a-zA-Z0-9!$&'()*+.=-_~:@/?]*)?)(\s+|$)/gi;
		let links = message.match(kLINK_DETECTION_REGEX);
		let found = '';
		if (links)
			for (let i = 0; i < links.length; i++) {
				if (links[i].includes(link))
					found = links[i];
			}
		return found.trim();
	},
	trimChar(s, mask) {
		while (~mask.indexOf(s[0])) {
			s = s.slice(1);
		}
		while (~mask.indexOf(s[s.length - 1])) {
			s = s.slice(0, -1);
		}
		return s;
	},
	getTwitterScreenName(account) {
		return this.trimChar(account, "@").toLowerCase();
	},
	parseTwitterAccountFromLink(link) {
		link = this.trimChar(link, "/");
		let n = link.lastIndexOf("/");
		if (n === -1)
			return ''
		else
			return '@' + link.substring(n + 1);
	},
	getModuleName(id) {
		let n = id.lastIndexOf("\\");
		if (n === -1)
			n = id.lastIndexOf("/");
		if (n === -1)
			return ''
		else
			return id.substring(n + 1);
	},
	ETH: eth_utils,
	ADM: adm_utils,
};
