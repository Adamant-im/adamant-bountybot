const api = require('../../modules/api');
const config = require('../../modules/configReader');
const eth_utils = require('./eth_utils');
const adm_utils = require('./adm_utils');
const LskCoin = require('./lsk_utils');
const log = require('../log');
const Store = require('../../modules/Store');
const helpers = require('../utils');

module.exports = {
  /**
   * Get address from ADM address
   * @param {String} coin
   * @param {String} admAddress
   * @return {Promise<*>}
   */
  async getAddressCryptoFromAdmAddressADM(coin, admAddress) {
    try {
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
    } catch (e) {
      log.error(`Error in getAddressCryptoFromAdmAddressADM() of ${helpers.getModuleName(module.id)} module: ${e}`);
    }
  },

  /**
   * Update all balances
   * @return {Promise<void>}
   */
  async updateAllBalances() {
    try {
      await this.ETH.updateBalance();
      await this.ADM.updateBalance();
      await this.LSK.updateBalance();
      for (const t of config.erc20) {
        await this[t].updateBalance();
      }
    } catch (e) {
      log.error(`Error in updateAllBalances() of ${helpers.getModuleName(module.id)} module: ${e}`);
    }
  },

  /**
   * Get last blocks numbers
   * @return {Promise<Object>}
   */
  async getLastBlocksNumbers() {
    try {
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
    } catch (e) {
      log.error(`Error in getLastBlocksNumbers() of ${helpers.getModuleName(module.id)} module: ${e}`);
    }
  },

  /**
   * Returns true if coin is in known_crypto list in config
   * @param {String} coin
   * @return {Boolean}
   */
  isKnown(coin) {
    return config.known_crypto.includes(coin);
  },
  /**
   * Returns true if coin is in accepted_crypto list in config
   * @param {String} coin
   * @return {Boolean}
   */
  isAccepted(coin) {
    return config.accepted_crypto.includes(coin);
  },
  /**
   * Returns true if coin is in exchange_crypto list in config
   * @param {String} coin
   * @return {Boolean}
   */
  isExchanged(coin) {
    return config.exchange_crypto.includes(coin);
  },
  /**
   * Returns true if coin is fiat money
   * @param {String} coin
   * @return {Boolean}
   */
  isFiat(coin) {
    return ['USD', 'RUB', 'EUR', 'CNY', 'JPY'].includes(coin);
  },
  isHasTicker(coin) { // if coin has ticker like COIN/OTHERCOIN or OTHERCOIN/COIN
    const pairs = Object.keys(Store.currencies).toString();
    return pairs.includes(',' + coin + '/') || pairs.includes('/' + coin);
  },
  /**
   * Returns true if coin is ERC-20 coin
   * @param {String} coin
   * @return {Boolean}
   */
  isERC20(coin) {
    return config.erc20.includes(coin.toUpperCase());
  },

  /**
   * Get Twitter accounts
   * @param {String} message
   * @return {void}
   */
  getAccounts(message) {
    const userAccounts = {};
    try {
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
    } catch (e) {
      log.error(`Error in getAccounts(message: ${message}) of ${helpers.getModuleName(module.id)} module: ${e}`);
    }

    return userAccounts;
  },

  /**
   * Get Twitter account by matching regex and message
   * @param {String} message
   * @return {Object}
   */
  findTwitterAccount(message) {
    const pattern = /(?<=^|(?<=[^a-zA-Z0-9-_.]))@([A-Za-z]+[A-Za-z0-9-_]+)/gi;
    const accounts = message.match(pattern);
    if (accounts) {
      return accounts[0].toLowerCase();
    }
  },

  /**
   * Get Twitter account by matching regex and message
   * @param {String} message
   * @param {String} link
   * @return {String}
   */
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

  /**
   * Trims char
   * @param {String} s
   * @param {String} mask
   * @return {String}
   */
  trimChar(s, mask) {
    while (~mask.indexOf(s[0])) {
      s = s.slice(1);
    }
    while (~mask.indexOf(s[s.length - 1])) {
      s = s.slice(0, -1);
    }
    return s;
  },

  /**
   * Trims @ symbol in twitter name
   * @param {String} account
   * @return {String}
   */
  getTwitterScreenName(account) {
    return this.trimChar(account, '@').toLowerCase();
  },

  /**
   * Parses twitter name from link
   * @param {String} link
   * @return {String}
   */
  parseTwitterAccountFromLink(link) {
    link = this.trimChar(link, '/');
    const n = link.lastIndexOf('/');
    if (n === -1) {
      return '';
    } else {
      return '@' + link.substring(n + 1).toLowerCase();
    }
  },

  /**
   * Get twitter ID from link
   * @param {String} link
   * @return {String}
   */
  getTweetIdFromLink(link) {
    link = this.trimChar(link, '/');
    const n = link.lastIndexOf('/');
    if (n === -1) {
      return '';
    } else {
      return link.substring(n + 1);
    }
  },

  /**
   * Get twitter hashtags
   * @param {String }tags
   * @return {Array<String>}
   */
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
