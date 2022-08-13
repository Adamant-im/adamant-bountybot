const {SAT} = require('../helpers/const');
const api = require('./api');
const notify = require('../helpers/notify');
const config = require('./configReader');

module.exports = async (itx, tx) => {
  const msg = itx.encrypted_content;
  let inCurrency;
  let outCurrency;
  let inAmountMessage;

  if (tx.amount > 0) { // ADM income payment
    inAmountMessage = tx.amount / SAT;
    inCurrency = 'ADM';
    outCurrency = msg;
  } else if (msg.includes('_transaction')) { // not ADM income payment
    inCurrency = msg.match(/"type":"(.*)_transaction/)[1];
    try {
      const json = JSON.parse(msg);
      inAmountMessage = Number(json.amount);
      outCurrency = json.comments;
      if (outCurrency === '') {
        outCurrency = 'NONE';
      }
    } catch (e) {
      inCurrency = 'none';
    }
  }

  outCurrency = String(outCurrency).toUpperCase().trim();
  inCurrency = String(inCurrency).toUpperCase().trim();

  // Validate
  const msgSendBack = `I got a transfer from you. Thanks, bro.`;
  const msgNotify = `${config.notifyName} got a transfer of ${inAmountMessage} ${inCurrency} from user ${tx.senderId}. I will not verify the transaction, check it manually. Income ADAMANT Tx: https://explorer.adamant.im/tx/${tx.id}.`;
  const notifyType = 'log';

  await itx.update({isProcessed: true}, true);

  notify(msgNotify, notifyType);
  await api.sendMessageWithLog(config.passPhrase, tx.senderId, msgSendBack);
};
