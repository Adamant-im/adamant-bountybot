const db = require('./DB');
const config = require('./configReader');
const $u = require('../helpers/utils');
const log = require('../helpers/log');
const notify = require('../helpers/notify');

module.exports = async () => {

    const {usersDb, paymentsDb} = db;

	(await usersDb.find({
        isInCheck: true,
        isTasksCompleted: false
	})).forEach(async user => {
		try {
            const {
                userId,
                isTwitterFollowCheckPassed,
                isTwitterRetweetCommentCheckPassed,
                isAdamantCheckPassed
            } = user;

            console.log(`Running module ${$u.getModuleName(module.id)} for user ${userId}..`);

            let msgSendBack = '';
            
            if (((config.twitter_follow.length === 0) || isTwitterFollowCheckPassed)
                && ((config.twitter_retweet_w_comment.length === 0) || isTwitterRetweetCommentCheckPassed)
                && ((config.adamant_campaign.min_contacts === 0) || isAdamantCheckPassed)) {
                    await user.update({
                        isInCheck: false,
                        isTasksCompleted: true
                    }, true);
                    config.rewards.forEach(reward => {
                        payment = new paymentsDb({
                            date: $u.unix(),
                            userId,
                            isPayed: false,
                            isFinished: false,
                            outCurrency: reward.currency,
                            outAmount: reward.amount,
                            outTxid: null,
                            outAddress: null
                        });
                        payment.save();
                    })
                    if (config.notifyTasksCompleted)
                        notify(`${config.notifyName}: User ${userId} completed the Bounty tasks. Payouts are pending.`, 'log');
                    msgSendBack = `Thank you! The Bounty tasks are completed! I am sending the reward to you.`;
                    $u.sendAdmMsg(userId, msgSendBack);
                }
                
		} catch (e) {
			log.error(`Error in ${$u.getModuleName(module.id)} module: ${e}`);
        }
        
	});

};

setInterval(() => {
    module.exports();
}, 15 * 1000);
