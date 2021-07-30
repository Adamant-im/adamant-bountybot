const db = require('./DB');
const config = require('./configReader');
const $u = require('../helpers/utils');
const log = require('../helpers/log');
const notify = require('../helpers/notify');
const mathjs = require('mathjs');

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
                isAdamantCheckPassed,
                twitterAccount,
                twitterFollowers,
                twitterLifetimeDays
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
                        let amount = reward.amount;
                        // console.log(config.rewards_progression_from_twitter_followers[reward.currency]);
                        if (config.rewards_progression_from_twitter_followers[reward.currency] && twitterFollowers) {
                            let followersCount = twitterFollowers;
                            if (followersCount > config.rewards_progression_from_twitter_followers[reward.currency].limit_followers)
                                followersCount = config.rewards_progression_from_twitter_followers[reward.currency].limit_followers;
                            let f = config.rewards_progression_from_twitter_followers[reward.currency].func;
                            amount = mathjs.evaluate(f, {followers: followersCount});
                            amount = +amount.toFixed(config.rewards_progression_from_twitter_followers[reward.currency].decimals_transfer);
                            // console.log(amount);
                            // process.exit(1);
                        }
                        payment = new paymentsDb({
                            date: $u.unix(),
                            userId,
                            isPayed: false,
                            isFinished: false,
                            outCurrency: reward.currency,
                            outAmount: amount,
                            outTxid: null,
                            outAddress: null
                        });
                        payment.save();
                    })
                    if (config.notifyTasksCompleted) {
                        let twitterString = '';
                        if (twitterAccount)
                            twitterString += ` (${twitterAccount}`;
                        if (twitterFollowers)
                            twitterString += `, followers: ${twitterFollowers}`;
                        if (twitterLifetimeDays)
                            twitterString += `, lifetime days: ${Math.round(twitterLifetimeDays)}`;
                        if (twitterAccount)
                            twitterString += `)`;
                        notify(`${config.notifyName}: User ${userId}${twitterString} completed the Bounty tasks. Payouts are pending.`, 'log');
                    }
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
}, 10 * 1000);
