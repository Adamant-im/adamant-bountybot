const db = require('./DB');
const config = require('./configReader');
const $u = require('../helpers/cryptos');
const helpers = require('../helpers/utils');
const api = require('./api');
const Store = require('./Store');
const log = require('../helpers/log');
const notify = require('../helpers/notify');

module.exports = async () => {
  const {PaymentsDb} = db;
  await $u.updateAllBalances();

  (await PaymentsDb.find({
    isPayed: false,
    isFinished: false,
    outTxid: null,
    outAddress: {$ne: null},
  })).forEach(async (pay) => {
    try {
      pay.trySendCounter = pay.trySendCounter || 0;
      const {
        userId,
        outAmount,
        outCurrency,
        outAddress,
      } = pay;

      let etherString = '';
      let isNotEnoughBalance;

      if ($u.isERC20(outCurrency)) {
        etherString = `Ether balance: ${Store.user['ETH'].balance}. `;
        isNotEnoughBalance = (outAmount > Store.user[outCurrency].balance) || ($u[outCurrency].FEE > Store.user['ETH'].balance);
      } else {
        etherString = '';
        isNotEnoughBalance = outAmount + $u[outCurrency].FEE > Store.user[outCurrency].balance;
      }

      if (isNotEnoughBalance) {
        pay.update({
          error: 15,
          isFinished: true,
          isPayed: false,
        }, true);
        notify(`${config.notifyName} notifies about insufficient balance to send a reward of _${outAmount}_ _${outCurrency}_. Balance of _${outCurrency}_ is _${Store.user[outCurrency].balance}_. ${etherString}User ADAMANT id: ${userId}.`, 'error');
        const msgSendBack = `I can’t transfer a reward of _${outAmount}_ _${outCurrency}_ to you because of insufficient funds (I count blockchain fees also). I have already notified my master.`;
        await api.sendMessageWithLog(config.passPhrase, userId, msgSendBack);
        return;
      }

      log.log(`Attempt number ${pay.trySendCounter} to send the reward payout. Coin: ${outCurrency}, recipient address: ${outAddress}, amount: ${outAmount}, bot's balance: ${Store.user[outCurrency].balance} ${outCurrency}.`);
      const result = await $u[outCurrency].send({
        address: outAddress,
        value: outAmount,
        comment: 'Was it great? Share the experience with your friends!', // if ADM
      });
      log.log(`Payout result: ${JSON.stringify(result, 0, 2)}`);

      if (result.success) {
        pay.update({
          outTxid: result.hash,
          isPayed: true,
        }, true);

        // Update local balances without unnecessary requests
        if ($u.isERC20(outCurrency)) {
          Store.user[outCurrency].balance -= outAmount;
          Store.user['ETH'].balance -= $u[outCurrency].FEE;
        } else {
          Store.user[outCurrency].balance -= (outAmount + $u[outCurrency].FEE);
        }
        log.info(`Successful payout of ${outAmount} ${outCurrency} to ${userId}. Hash: ${result.hash}.`);
      } else { // Can't make a transaction
        if (pay.trySendCounter++ < 50) { // If number of attempts less then 50, just ignore and try again on next tick
          await pay.save();
          return;
        }

        pay.update({
          error: 16,
          isFinished: true,
          isPayed: false,
        }, true);
        notify(`${config.notifyName} cannot make transaction to payout a reward of _${outAmount}_ _${outCurrency}_. Balance of _${outCurrency}_ is _${Store.user[outCurrency].balance}_. ${etherString}User ADAMANT id: ${userId}.`, 'error');
        const msgSendBack = `I’ve tried to make a reward payout of _${outAmount}_ _${outCurrency}_ to you, but something went wrong. I have already notified my master.`;
        await api.sendMessageWithLog(config.passPhrase, userId, msgSendBack);
      }
    } catch (e) {
      log.error(`Error in ${helpers.getModuleName(module.id)} module: ${e.toString()}`);
    }
  });
};

setInterval(() => {
  module.exports();
}, 15 * 1000);
