
const db = require('./DB');
const $u = require('../helpers/utils');
const log = require('../helpers/log');

module.exports = async (itx, tx) => {

	console.log(`Running module ${$u.getModuleName(module.id)}..`);
	
	const {usersDb} = db;
	let user = {};
	let msgSendBack = '';

	// Exclude duplicate Twitter accounts
	user = await usersDb.findOne({twitterAccount: itx.accounts.twitterAccount});
	if (user && (user.isInCheck || user.isTasksCompleted)) {
		// This Twitter account is already in use by other user, unable to switch
		log.info(`User ${user.userId} applied with already used Twitter account ${itx.accounts.twitterAccount}. Notify user and ignore.`);
		if (user.userId !== tx.senderId) {
			msgSendBack = `This Twitter account is already in use by other participant. If it's a mistake, try again in a few minutes.`;
		} else {
			if (user.isTasksCompleted) {
				msgSendBack = `You've already completed the Bounty tasks.`;
			}
		}
		if (msgSendBack) // Do not send anything, if isInCheck
			$u.sendAdmMsg(tx.senderId, msgSendBack);
		return;
	}

	// Check if user apply for check once again
	user = await usersDb.findOne({userId: tx.senderId});
	if (user) {
		// User is already was in check earlier, update
		log.info(`User ${user.userId} applied once again.`);
		// May be later
		// if (user.isBountyPayed) {
		// 	msgSendBack = `You've already received the Bounty reward. Thanks for your support!`;
		// 	$u.sendAdmMsg(tx.senderId, msgSendBack);
		// 	return;
		// } else 
		if (user.isTasksCompleted) {
			log.info(`User ${user.userId} already completed the Bounty tasks. Notify user and ignore.`);
			msgSendBack = `You've already completed the Bounty tasks.`;
			$u.sendAdmMsg(tx.senderId, msgSendBack);
			return;
		}
	
		user.update({
			dateUpdated: $u.unix(),
			admTxId: tx.id,
			msg: itx.encrypted_content,
			isInCheck: itx.accounts.notEmpty,
			twitterAccountLink: itx.accounts.twitterLink,
			twitterAccount: itx.accounts.twitterAccount,
			twitterAccountId: null,
			isTasksCompleted: false,
			isTwitterFollowCheckPassed: false,
			isTwitterRetweetCommentCheckPassed: false,
			isTwitterAccountEligible: false
		});

	} else {
		// First time user, create new
		user = new usersDb({
			_id: tx.senderId,
			userId: tx.senderId,
			dateCreated: $u.unix(),
			dateUpdated: $u.unix(),
			admTxId: tx.id,
			msg: itx.encrypted_content,
			isInCheck: itx.accounts.notEmpty,
			twitterAccountLink: itx.accounts.twitterLink,
			twitterAccount: itx.accounts.twitterAccount,
			twitterAccountId: null,
			isTasksCompleted: false,
			isTwitterFollowCheckPassed: false,
			isTwitterRetweetCommentCheckPassed: false,
			isTwitterAccountEligible: false,
			isAdamantCheckPassed: false,
		});
	}

	await user.save();
	await itx.update({isProcessed: true}, true);

	console.log('User info:', user);

	msgSendBack = `I've got your account details. Twitter: ${user.twitterAccount}. I'll check if you've finished the Bounty tasks now..`;
	$u.sendAdmMsg(tx.senderId, msgSendBack);

};
