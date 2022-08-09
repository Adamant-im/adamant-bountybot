const db = require('./DB');
const config = require('./configReader');
const $u = require('../helpers/utils');
const helpers = require('../helpers');
const api = require('./api');
const Store = require('./Store');
const log = require('../helpers/log');
const notify = require('../helpers/notify');

module.exports = async () => {
  const {PaymentsDb} = db;
  const lastBlockNumber = await $u.getLastBlocksNumbers();

  (await PaymentsDb.find({
    isPayed: true,
    isFinished: false,
    outTxid: {$ne: null},
  })).forEach(async (pay) => {
    const {
      outCurrency,
      userId,
      outAmount,
      outTxid,
    } = pay;

    pay.tryVerifyPayoutCounter = ++pay.tryVerifyPayoutCounter || 0;

    try {
      let msgNotify = '';
      let notifyType = '';
      let msgSendBack = '';

      let etherString = '';
      if ($u.isERC20(outCurrency)) {
        etherString = `Ether balance: ${Store.user['ETH'].balance}. `;
      }

      if (!lastBlockNumber[outCurrency]) {
        log.warn('Unable to get lastBlockNumber for ' + outCurrency + '. Waiting for next try.');
        return;
      }

      const txData = (await $u[outCurrency].getTransactionStatus(outTxid));
      if (!txData || !txData.blockNumber) {
        if (pay.tryVerifyPayoutCounter > 50 ) {
          pay.update({
            errorCheckOuterTX: 24,
            isFinished: true,
          });

          notifyType = 'error';
          msgNotify = `${config.notifyName} unable to verify the reward payout of _${outAmount}_ _${outCurrency}_. Attention needed. Tx hash: _${outTxid}_. Balance of _${outCurrency}_ is _${Store.user[outCurrency].balance}_. ${etherString}User ADAMANT id: ${userId}.`;
          msgSendBack = `I’ve tried to make the reward payout of _${outAmount}_ _${outCurrency}_ to you, but unable to validate transaction. Tx hash: _${outTxid}_. I’ve already notified my master. If you wouldn’t receive transfer in two days, contact my master also.`;

          notify(msgNotify, notifyType);
          await api.sendMessage(config.passPhrase, userId, msgSendBack);
        }
        await pay.save();
        return;
      }

      const {status, blockNumber} = txData;

      pay.update({
        outTxStatus: status,
        outConfirmations: lastBlockNumber[outCurrency] - blockNumber,
      });

      if (status === false) {
        notifyType = 'error';
        pay.update({
          errorValidatorSend: 21,
          outTxid: null,
          isPayed: false,
          isFinished: false,
        });

        msgNotify = `${config.notifyName} notifies that the reward payout of _${outAmount}_ _${outCurrency}_ failed. Tx hash: _${outTxid}_. Will try again. Balance of _${outCurrency}_ is _${Store.user[outCurrency].balance}_. ${etherString}User ADAMANT id: ${userId}.`;
        msgSendBack = `I’ve tried to make the payout transfer of _${outAmount}_ _${outCurrency}_ to you, but it seems transaction failed. Tx hash: _${outTxid}_. I will try again. If I’ve said the same several times already, please contact my master.`;

        await api.sendMessage(config.passPhrase, userId, msgSendBack);
      } else if (status && pay.outConfirmations >= config.min_confirmations) {
        notifyType = 'info';
        if (config.notifyRewardReceived) {
          msgNotify = `${config.notifyName} successfully payed the reward of _${outAmount} ${outCurrency}_ to ${userId} with Tx hash _${outTxid}_.`;
        }
        msgSendBack = 'Was it great? Share the experience with your friends!';

        if (outCurrency !== 'ADM') {
          msgSendBack = `{"type":"${outCurrency.toLowerCase()}_transaction","amount":"${outAmount}","hash":"${outTxid}","comments":"${msgSendBack}"}`;
          const message = await api.sendMessage(config.passPhrase, userId, msgSendBack, 'rich');
          if (message.success) {
            pay.isFinished = true;
          } else {
            log.warn(`Failed to send ADM message on sent Tx ${outTxid} of ${outAmount} ${outCurrency} to ${userId}. I will try again. ${message?.errorMessage}.`);
          }
        } else {
          pay.isFinished = true;
        }
      }

      await pay.save();

      if (msgNotify) {
        notify(msgNotify, notifyType);
      }
    } catch (e) {
      log.error(`Error in ${helpers.getModuleName(module.id)} module: ${e}`);
    }
  });
};

setInterval(() => {
  module.exports();
}, 8 * 1000);
