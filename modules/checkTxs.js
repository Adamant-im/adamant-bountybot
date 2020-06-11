
const db = require('./DB');
const {SAT} = require('../helpers/const');
const $u = require('../helpers/utils');
const notify = require('../helpers/notify');
const log = require('../helpers/log');
const config = require('./configReader');
const Store = require('./Store');
const deepExchangeValidator = require('./outAddressFetcher');

module.exports = async (itx, tx) => {

	console.log(`Running module ${$u.getModuleName(module.id)}..`);
	
	const {usersDb} = db;
	let user = {};
	let msgSendBack = false;
	let msgNotify = false;
	let notifyType = 'info';

	// Exclude duplicate Twitter accounts
	user = await usersDb.findOne({twitterAccountLink: itx.links.twitter});
	if (user && (user.userId !== tx.senderId) && (user.isInCheck || user.isTasksCompleted)) {
		// This Twitter account is already in use by other user, unable to switch
		msgSendBack = `This Twitter account is already in use by other participant. If it's a mistake, try again in a few minutes.`;
		$u.sendAdmMsg(tx.senderId, msgSendBack);
		return;
	}

	// Check if user apply for check once again
	user = await usersDb.findOne({userId: tx.senderId});
	if (user) {
		// User is already was in check earlier, update
		console.log(`User ${user.userId} applied once again.`);
		if (user.isBountyPayed) {
			msgSendBack = `You've already received the Bounty reward. Thanks for your support!`;
			$u.sendAdmMsg(tx.senderId, msgSendBack);
			return;
		} else if (user.isTasksCompleted) {
			msgSendBack = `You've already completed the Bounty tasks. Just wait for a payout.`;
			$u.sendAdmMsg(tx.senderId, msgSendBack);
			return;
		}
	
		user.update({
			msg: itx.encrypted_content,
			isInCheck: itx.links.notEmpty,
			twitterAccountLink: itx.links.twitter,
			dateUpdated: $u.unix(),
			admTxId: tx.id,
			isTwitterFollowCheckPassed: false,
			isTwitterRetweetCommentCheckPassed: false
		});

	} else {
		// First time user, create new
		user = new usersDb({
			_id: tx.senderId,
			dateCreated: $u.unix(),
			dateUpdated: $u.unix(),
			admTxId: tx.id,
			userId: tx.senderId,
			msg: itx.encrypted_content,
			isInCheck: itx.links.notEmpty,
			twitterAccountLink: itx.links.twitter,
			isTasksCompleted: false,
			isTwitterFollowCheckPassed: false,
			isTwitterRetweetCommentCheckPassed: false
		});
	}

	// 	notifyType = 'warn';
	// 	msgNotify = `${config.notifyName} notifies about unknown rates of crypto _${outCurrency}_. Will try to send payment of _${inAmountMessage}_ _${inCurrency}_ back. Income ADAMANT Tx: https://explorer.adamant.im/tx/${tx.id}.`;
	//	notify(msgNotify, notifyType);

	await user.save();
	await itx.update({isProcessed: true}, true);

	console.log('User info:', user);

	msgSendBack = `I've got your account details. Twitter: ${user.twitterAccountLink}. I'll check if you've finished the Bounty tasks and come back to you soon. This will take a few minutes.`;
	$u.sendAdmMsg(tx.senderId, msgSendBack);

};
