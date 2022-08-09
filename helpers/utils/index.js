const api = require('../../modules/api');
const config = require('../../modules/configReader');
const eth_utils = require('./eth_utils');
const adm_utils = require('./adm_utils');
const LskCoin = require('./lsk_utils');
const log = require('../log');
const Store = require('../../modules/Store');
const helpers = require('../../helpers');

module.exports = {
  async getAddressCryptoFromAdmAddressADM(coin, admAddress) {
    if (this.isERC20(coin)) {
      coin = 'ETH';
    }
    const kvsRecords = await api.get('states/get', {senderId: admAddress, key: coin.toLowerCase() + ':address', orderBy: 'timestamp:desc'});
    if (kvsRecords.success) {
      if (kvsRecords.data.transactions.length) {
        return kvsRecords.data.transactions[0].asset.state.value;
      } else {
        return 'none';
      }
    } else {
      log.warn(`Failed to get ${coin} address for ${admAddress} from KVS in getAddressCryptoFromAdmAddressADM() of ${helpers.getModuleName(module.id)} module. ${kvsRecords.errorMessage}.`);
    }
  },
  async updateAllBalances() {
    try {
      await this.ETH.updateBalance();
      await this.ADM.updateBalance();
      await this.LSK.updateBalance();
      for (const t of config.erc20) {
        await this[t].updateBalance();
      }
    } catch (e) {}
  },
  async getLastBlocksNumbers() {
    const data = {
      ETH: await this.ETH.getLastBlock(),
      ADM: await this.ADM.getLastBlock(),
      LSK: await this.LSK.getLastBlockHeight(),
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
  getAccounts(message) {
    const userAccounts = {};
    userAccounts.notEmpty = false;

    userAccounts.twitterLink = this.findLink(message, 'twitter.com');
    if (userAccounts.twitterLink) {
      userAccounts.twitterAccount = this.parseTwitterAccountFromLink(userAccounts.twitterLink);
    } else {
      userAccounts.twitterAccount = this.findTwitterAccount(message);
    }

    userAccounts.facebookLink = this.findLink(message, 'facebook.com');

    if (userAccounts.twitterAccount && config.isTwitterCampaign) {
      userAccounts.notEmpty = true;
    }
    if (userAccounts.facebookAccount && config.isFacebookCampaign) {
      userAccounts.notEmpty = true;
    }
    return userAccounts;
  },
  findTwitterAccount(message) {
    const pattern = /(?<=^|(?<=[^a-zA-Z0-9-_.]))@([A-Za-z]+[A-Za-z0-9-_]+)/gi;
    const accounts = message.match(pattern);
    if (accounts) {
      return accounts[0].toLowerCase();
    }
  },
  findLink(message, link) {
    const kLINK_DETECTION_REGEX = /(([a-z]+:\/\/)?(([a-z0-9-]+\.)+([a-z]{2}|aero|arpa|biz|com|coop|edu|gov|info|int|jobs|mil|museum|name|nato|net|org|pro|travel|local|internal))(:[0-9]{1,5})?(\/[a-z0-9_\-.~]+)*(\/([a-z0-9_\-.]*)(\?[a-z0-9+_\-.%=&amp;]*)?)?(#[a-zA-Z0-9!$&'()*+.=-_~:@/?]*)?)(\s+|$)/gi;
    const links = message.match(kLINK_DETECTION_REGEX);
    let found = '';
    if (links) {
      for (let i = 0; i < links.length; i++) {
        if (links[i].includes(link)) {
          found = links[i];
        }
      }
    }
    return found.trim().toLowerCase();
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
    return this.trimChar(account, '@').toLowerCase();
  },
  parseTwitterAccountFromLink(link) {
    link = this.trimChar(link, '/');
    const n = link.lastIndexOf('/');
    if (n === -1) {
      return '';
    } else {
      return '@' + link.substring(n + 1).toLowerCase();
    }
  },
  getTweetIdFromLink(link) {
    link = this.trimChar(link, '/');
    const n = link.lastIndexOf('/');
    if (n === -1) {
      return '';
    } else {
      return link.substring(n + 1);
    }
  },
  getTwitterHashtags(tags) {
    for (let i = 0; i < tags.length; i++) {
      tags[i] = this.trimChar(tags[i], '#');
    }
    return tags;
  },
  ETH: eth_utils,
  ADM: adm_utils,
  LSK: new LskCoin('LSK'),
};
