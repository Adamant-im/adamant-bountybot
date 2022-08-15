const Store = require('../modules/Store');
const $u = require('../helpers/cryptos');
const api = require('./api');
const helpers = require('../helpers/utils');
const config = require('./configReader');
const log = require('../helpers/log');
const notify = require('../helpers/notify');
const twitterapi = require('./twitterapi');

module.exports = async (cmd, tx, itx) => {
  if (itx.isProcessed) return;
  log.log(`Got new command Tx to process: ${cmd} from ${tx.senderId}`);

  try {
    let res = [];
    const group = cmd
        .trim()
        .replace(/ {4}/g, ' ')
        .replace(/ {3}/g, ' ')
        .replace(/ {2}/g, ' ')
        .split(' ');
    const methodName = group.shift().trim().toLowerCase().replace('/', '');

    // do not process commands from non-admin accounts
    if (!config.admin_accounts.includes(tx.senderId) && admin_commands.includes(methodName)) {
      log.warn(`${config.notifyName} received an admin command from non-admin user _${tx.senderId}_. Ignoring. Income ADAMANT Tx: https://explorer.adamant.im/tx/${tx.id}.`);
      itx.update({
        isProcessed: true,
        isNonAdmin: true,
      }, true);
      if (config.notify_non_admins) {
        const msgSendBack = `I won't execute admin commands as you are not an admin. Contact my master.`;
        await api.sendMessageWithLog(config.passPhrase, tx.senderId, msgSendBack);
      }
      return;
    }

    const m = commands[methodName];
    if (m) {
      res = await m(group, tx);
    } else {
      res.msgSendBack = `I don’t know */${methodName}* command. ℹ️ You can start with **/help**.`;
    }
    if (!tx) {
      return res.msgSendBack;
    }
    if (tx) {
      itx.update({isProcessed: true}, true);
      if (res.msgNotify) {
        notify(res.msgNotify, res.notifyType);
      }
      if (res.msgSendBack) {
        await api.sendMessageWithLog(config.passPhrase, tx.senderId, res.msgSendBack);
      }
    }
  } catch (e) {
    tx = tx || {};
    log.error('Error while processing command ' + cmd + ' from senderId ' + tx.senderId + '. Tx Id: ' + tx.id + '. Error: ' + e);
  }
};

function help() {
  return {
    msgNotify: ``,
    msgSendBack: `${config.help_message}`,
    notifyType: 'log',
  };
}

async function rates(params) {
  let output = '';

  try {
    const coin1 = params[0].toUpperCase().trim();

    if (!coin1 || !coin1.length) {
      output = 'Please specify coin ticker or specific market you are interested in. F. e., */rates ADM*.';
      return {
        msgNotify: ``,
        msgSendBack: `${output}`,
        notifyType: 'log',
      };
    }
    const currencies = Store.currencies;
    const res = Object
        .keys(Store.currencies)
        .filter((t) => t.startsWith(coin1 + '/'))
        .map((t) => {
          const p = `${coin1}/**${t.replace(coin1 + '/', '')}**`;
          return `${p}: ${currencies[t]}`;
        })
        .join(', ');

    if (!res.length) {
      output = `I can’t get rates for *${coin1}*. Made a typo? Try */rates ADM*.`;
      return {
        msgNotify: ``,
        msgSendBack: `${output}`,
        notifyType: 'log',
      };
    } else {
      output = `Global market rates for ${coin1}:\n${res}.`;
    }
  } catch (e) {
    log.error(`Error in rates() of ${helpers.getModuleName(module.id)} module: ${e}`);
  }

  return {
    msgNotify: ``,
    msgSendBack: output,
    notifyType: 'log',
  };
}

async function calc(arr) {
  let output = '';

  try {
    if (arr.length !== 4) {
      return {
        msgNotify: ``,
        msgSendBack: 'Wrong arguments. Command works like this: */calc 2.05 BTC in USDT*.',
        notifyType: 'log',
      };
    }

    const amount = +arr[0];
    const inCurrency = arr[1].toUpperCase().trim();
    const outCurrency = arr[3].toUpperCase().trim();

    if (!amount || amount === Infinity) {
      output = `It seems amount "*${amount}*" for *${inCurrency}* is not a number. Command works like this: */calc 2.05 BTC in USDT*.`;
    }
    if (!$u.isHasTicker(inCurrency)) {
      output = `I don’t have rates of crypto *${inCurrency}* from Infoservice. Made a typo? Try */calc 2.05 BTC in USDT*.`;
    }
    if (!$u.isHasTicker(outCurrency)) {
      output = `I don’t have rates of crypto *${outCurrency}* from Infoservice. Made a typo? Try */calc 2.05 BTC in USDT*.`;
    }

    let result;
    if (!output) {
      result = Store.mathEqual(inCurrency, outCurrency, amount, true).outAmount;
      if (amount <= 0 || result <= 0 || !result) {
        output = `I didn’t understand amount for *${inCurrency}*. Command works like this: */calc 2.05 BTC in USDT*.`;
      } else {
        if ($u.isFiat(outCurrency)) {
          result = +result.toFixed(2);
        }
        output = `Global market value of ${helpers.thousandSeparator(amount)} ${inCurrency} equals **${helpers.thousandSeparator(result)} ${outCurrency}**.`;
      }
    }
  } catch (e) {
    log.error(`Error in calc() of ${helpers.getModuleName(module.id)} module: ${e}`);
  }

  return {
    msgNotify: ``,
    msgSendBack: output,
    notifyType: 'log',
  };
}

async function test(param) {
  let output;

  try {
    param = param[0].trim();
    if (!param || !['twitterapi'].includes(param)) {
      return {
        msgNotify: ``,
        msgSendBack: 'Wrong arguments. Command works like this: */test twitterapi*.',
        notifyType: 'log',
      };
    }

    if (param === 'twitterapi') {
      const testResult = await twitterapi.testApi();
      if (testResult.success) {
        output = 'Twitter API functions well.';
      } else {
        output = `Error while making Twitter API request: ${testResult.message}`;
      }
    }
  } catch (e) {
    log.error(`Error in test() of ${helpers.getModuleName(module.id)} module: ${e}`);
  }

  return {
    msgNotify: ``,
    msgSendBack: output,
    notifyType: 'log',
  };
}

function version() {
  return {
    msgNotify: ``,
    msgSendBack: `I am running on _adamant-bountybot_ software version _${Store.version}_. Revise code on ADAMANT's GitHub.`,
    notifyType: 'log',
  };
}

function balances() {
  let output = '';

  try {
    config.known_crypto.forEach((crypto) => {
      if (Store.user[crypto].balance) {
        output += `${helpers.thousandSeparator(+Store.user[crypto].balance.toFixed(8), true)} _${crypto}_`;
        output += '\n';
      }
    });
  } catch (e) {
    log.error(`Error in balances() of ${helpers.getModuleName(module.id)} module: ${e}`);
  }

  return {
    msgNotify: ``,
    msgSendBack: `My crypto balances:\n${output}`,
    notifyType: 'log',
  };
}

const commands = {
  help,
  rates,
  calc,
  version,
  balances,
  test,
};

const admin_commands = [
  'test',
  'balances',
];
