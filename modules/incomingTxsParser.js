const db = require('./DB');
const log = require('../helpers/log');
const $u = require('../helpers/utils');
const api = require('./api');
const config = require('./configReader');
const commandTxs = require('./commandTxs');
const unknownTxs = require('./unknownTxs');
const transferTxs = require('./transferTxs');
const checkTxs = require('./checkTxs');
const notify = require('../helpers/notify');

const historyTxs = {};

module.exports = async (tx) => {
  if (!tx) {
    return;
  }

  if (historyTxs[tx.id]) { // do not process one tx twice
    return;
  }

  const {IncomingTxsDb} = db;
  const checkedTx = await IncomingTxsDb.findOne({txid: tx.id});
  if (checkedTx !== null) {
    return;
  }

  log.log(`Received incoming transaction ${tx.id} from ${tx.senderId}.`);

  let msg = '';
  const chat = tx.asset.chat;
  if (chat) {
    msg = api.decodeMsg(chat.message, tx.senderPublicKey, config.passPhrase, chat.own_message).trim();
  }

  if (msg === '') {
    msg = 'NONE';
  }

  // Parse social accounts from user message
  const accounts = $u.getAccounts(msg);

  let type = 'unknown';
  if (msg.includes('_transaction') || tx.amount > 0) {
    type = 'transfer'; // just for special message
  } else if (accounts.notEmpty) {
    type = 'check';
  } else if (msg.startsWith('/')) {
    type = 'command';
  }

  // Check if we should notify about spammer, only once per 24 hours
  const spamerIsNotify = await IncomingTxsDb.findOne({
    sender: tx.senderId,
    isSpam: true,
    date: {$gt: ($u.unix() - 24 * 3600 * 1000)}, // last 24h
  });

  const itx = new IncomingTxsDb({
    _id: tx.id,
    txid: tx.id,
    date: $u.unix(),
    block_id: tx.blockId,
    encrypted_content: msg,
    accounts: accounts,
    spam: false,
    sender: tx.senderId,
    type, // check, command, transfer or unknown
    isProcessed: false,
    isNonAdmin: false,
  });

  const countRequestsUser = (await IncomingTxsDb.find({
    sender: tx.senderId,
    date: {$gt: ($u.unix() - 24 * 3600 * 1000)}, // last 24h
  })).length;

  if (countRequestsUser > 50 || spamerIsNotify) { // 50 per 24h is a limit for accepting commands, otherwise user will be considered as spammer
    itx.update({
      isProcessed: true,
      isSpam: true,
    });
  }

  await itx.save();
  if (historyTxs[tx.id]) {
    return;
  }
  historyTxs[tx.id] = $u.unix();

  if (itx.isSpam && !spamerIsNotify) {
    notify(`${config.notifyName} notifies _${tx.senderId}_ is a spammer or talks too much. Income ADAMANT Tx: https://explorer.adamant.im/tx/${tx.id}.`, 'warn');
    $u.sendAdmMsg(tx.senderId, `I’ve _banned_ you. You’ve sent too much transactions to me.`);
    return;
  }

  switch (type) {
    case ('transfer'):
      transferTxs(itx, tx);
      break;
    case ('check'):
      checkTxs(itx, tx);
      break;
    case ('command'):
      commandTxs(msg, tx, itx);
      break;
    default:
      unknownTxs(tx, itx);
      break;
  }
};
