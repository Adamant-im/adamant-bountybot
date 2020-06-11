const db = require('./DB');
const config = require('./configReader');
const $u = require('../helpers/utils');
const Store = require('./Store');
const log = require('../helpers/log');
const notify = require('../helpers/notify');
const twitterapi = require('./twitterapi');

module.exports = async () => {

    const {usersDb} = db;

	(await usersDb.find({
        isInCheck: true,
        isTasksCompleted: false
	})).forEach(async user => {
		try {
            const {
                userId,
                isTwitterFollowCheckPassed,
                isTwitterRetweetCommentCheckPassed
            } = user;

            console.log(`Running module ${$u.getModuleName(module.id)} for user ${user.userId}..`);

            let msgNotify = null;
			let msgNotifyType = null;
            let msgSendBack = null;
            
            if (((config.twitter_follow.length === 0) || isTwitterFollowCheckPassed)
                && ((config.twitter_retweet_w_comment.length === 0) || isTwitterRetweetCommentCheckPassed)) {
                    await user.update({
                        isInCheck: false,
                        isTasksCompleted: true
                    }, true);
                    config.rewards.forEach(reward => {
                        payment = new paymentsDb({
                            date: $u.unix(),
                            userId: user.userId,
                            isPayed: false,
                            isFinished: false,
                            outCurrency: reward.currency,
                            outAmount: reward.amount,
                            outTxid: null,
                            outAddress: null
                        });
                        await payment.save();
                    })
                    if (config.notifyTasksCompleted)
                        notify(`${config.notifyName}: User ${userId} completed the Bounty tasks. Payouts pending.`, 'info');
                    msgSendBack = `Thank you! The Bounty tasks are completed! I am sending you the reward.`;
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
