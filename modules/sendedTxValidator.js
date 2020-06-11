const db = require('./DB');
const config = require('./configReader');
const $u = require('../helpers/utils');
const Store = require('./Store');
const log = require('../helpers/log');
const notify = require('../helpers/notify');

module.exports = async () => {
	const {paymentsDb} = db;
	const lastBlockNumber = await $u.getLastBlocksNumbers();

	(await paymentsDb.find({
		isPayed: true,
		isFinished: false,
		outTxid: {$ne: null}
	})).forEach(async pay => {
		const {
			outCurrency,
			userId,
			outAmount,
			outTxid
		} = pay;

		pay.tryVerifyPayoutCounter = ++pay.tryVerifyPayoutCounter || 0;
		
		try {
			let msgNotify = null;
			let notifyType = null;
			let msgSendBack = null;

			if (!lastBlockNumber[outCurrency]) {
				log.warn('Cannot get lastBlockNumber for ' + outCurrency + '. Waiting for next try.');
				return;
			}

			const txData = (await $u[outCurrency].getTransactionStatus(outTxid));
			if (!txData || !txData.blockNumber) {
				if (pay.tryVerifyPayoutCounter > 50 ) {
					pay.update({
						errorCheckOuterTX: 24,
						isFinished: true
					});

					notifyType = 'error';
					msgNotify = `${config.notifyName} unable to verify reward payout of _${outAmount}_ _${outCurrency}_. Insufficient balance? Attention needed. Tx hash: _${outTxid}_. Balance of _${outCurrency}_ is _${Store.user[outCurrency].balance}_. ${etherString}User ADAMANT id: ${userId}.`;
					msgSendBack = `I’ve tried to make reward payout of _${outAmount}_ _${outCurrency}_ to you, but I cannot validate transaction. Tx hash: _${outTxid}_. I’ve already notified my master. If you wouldn’t receive transfer in two days, contact my master also.`;
						
					notify(msgNotify, notifyType);
					$u.sendAdmMsg(userId, msgSendBack);
				}
				pay.save();
				return;
			}

			const {status, blockNumber} = txData;

			if (!blockNumber) {
				return;
			}

			pay.update({
				outTxStatus: status,
				outConfirmations: lastBlockNumber[outCurrency] - blockNumber
			});

			if (status === false) {
				notifyType = 'error';
				pay.update({
					errorValidatorSend: 21,
					outTxid: null,
					isPayed: false,
					isFinished: false
				});

				msgNotify = `${config.notifyName} notifies that reward payout of _${outAmount}_ _${outCurrency}_ failed. Tx hash: _${outTxid}_. Will try again. Balance of _${outCurrency}_ is _${Store.user[outCurrency].balance}_. ${etherString}User ADAMANT id: ${userId}.`;
				msgSendBack = `I’ve tried to make payout transfer of _${outAmount}_ _${outCurrency}_ to you, but it seems transaction failed. Tx hash: _${outTxid}_. I will try again. If I’ve said the same several times already, please contact my master.`;

				$u.sendAdmMsg(userId, msgSendBack);

			} else if (status && pay.outConfirmations >= config['min_confirmations_' + outCurrency]) {

					notifyType = 'info';
					if (config.notifyRewardReceived)
						msgNotify = `${config.notifyName} successfully payed a reward of _${outAmount} ${outCurrency}_ to ${userId} with Tx hash _${outTxid}_.`;
					msgSendBack = 'Thank you for support! Was it great? Share your experience with your friends!';

				if (outCurrency !== 'ADM') {
					msgSendBack = `{"type":"${outCurrency}_transaction","amount":"${outAmount}","hash":"${outTxid}","comments":"${msgSendBack}"}`;
					pay.isFinished = $u.sendAdmMsg(userId, msgSendBack, 'rich');
				} else {
					pay.isFinished = true;
				}
			}
			await pay.save();

			if (msgNotify) {
				notify(msgNotify, notifyType);
			}
		} catch (e) {
			log.error(`Error in ${$u.getModuleName(module.id)} module: ${e}`);
		}
	});

};

setInterval(() => {
	module.exports();
}, 15 * 1000);
