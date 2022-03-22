const log = require('../helpers/log');
const $u = require('../helpers/utils');
const notify = require('../helpers/notify');
const config = require('./configReader');
const db = require('./DB');

module.exports = async () => {
  const {PaymentsDb} = db;

  (await PaymentsDb.find({
    isPayed: false,
    isFinished: false,
    outTxid: null,
    outAddress: null,
  })).forEach(async (pay) => {
    pay.tryFetchOutAddressCounter = ++pay.tryFetchOutAddressCounter || 0;

    // Fetching addresses from ADAMANT KVS
    try {
      let msgSendBack = false;
      let msgNotify = false;

      const outAddress = (pay.outCurrency === 'ADM' && pay.userId) || await $u.getAddressCryptoFromAdmAddressADM(pay.outCurrency, pay.userId);

      if (!outAddress) {
        if (pay.tryFetchOutAddressCounter < 20) {
          log.error(`Can't get ${pay.outCurrency} address from KVS for ${pay.userId}. Will try next time.`);
        } else {
          pay.update({
            error: 10,
            isFinished: true,
          });
          msgNotify = `${config.notifyName} can’t fetch ${pay.outCurrency} address from KVS for ${pay.userId} to pay a reward of _${pay.outAmount} ${pay.outCurrency}_.`;
          msgSendBack = `I can’t get your _${pay.outCurrency}_ address from ADAMANT KVS to pay a reward. Make sure you use ADAMANT wallet with _${pay.outCurrency}_ enabled. I have already notified my master.`;
          notify(msgNotify, 'error');
          let tx;
          $u.sendAdmMsg(tx.userId, msgSendBack);
        }
      } else {
        pay.update({
          outAddress: outAddress,
        });
      }

      await pay.save();
    } catch (e) {
      log.error(`Error in ${$u.getModuleName(module.id)} module: ${e}`);
    }
  });
};

setInterval(() => {
  module.exports();
}, 15 * 1000);
