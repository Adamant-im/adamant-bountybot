const db = require('./DB');
const config = require('./configReader');
const $u = require('../helpers/utils');
const log = require('../helpers/log');
const notify = require('../helpers/notify');
const twitterapi = require('./twitterapi');

module.exports = async () => {

    const {usersDb} = db;

	(await usersDb.find({
        $and: [
			{isInCheck: true},
            {isTwitterAccountEligible: true},
            {isTwitterRetweetCommentCheckPassed: false},
			{isTasksCompleted: false},
			{$or: [
                {isAdamantCheckPassed: true},
                {$expr: {$eq: [0, config.adamant_campaign.min_contacts]}}
			]}
		]
	})).forEach(async user => {
		try {
            const {
                twitterAccount,
                userId
            } = user;

            console.log(`Running module ${$u.getModuleName(module.id)} for user ${userId}..`);

            let msgNotify = '';
			let msgNotifyType = '';
            let msgSendBack = '';
            
            let toRetweet;
            let minMentions;
            let hashtags;
            let retweetResult;
            let isRetweeted;
            for (let index = 0; index < config.twitter_retweet_w_comment.length; index++) {
                toRetweet = config.twitter_retweet_w_comment[index].tweet;
                minMentions = config.twitter_retweet_w_comment[index].min_mentions;
                hashtags = config.twitter_retweet_w_comment[index].hashtags;
                retweetResult = await twitterapi.checkIfAccountRetweetedwComment(twitterAccount, toRetweet, minMentions, hashtags);
                isRetweeted = retweetResult.success;
                console.log('isRetweeted:', isRetweeted);

                if (isRetweeted) {
                    console.log(`User ${userId}.. ${twitterAccount} did retweet ${toRetweet}.`);

                } else {

                    await user.update({
                        isTwitterRetweetCommentCheckPassed: false,
                        isInCheck: false,
                        isTasksCompleted: false
                    }, true);
                    switch (retweetResult.error) {
                        case ('no_retweet'):
                            msgSendBack = `To meet the Bounty campaign rules, you should retweet ${toRetweet} with comment (quote).`;
                            if (minMentions > 0) {
                                msgSendBack += ` Mention at least ${minMentions} friends.`;
                            }
                            if (hashtags.length > 0) {
                                msgSendBack += ` Use ${config.twitter_retweet_w_comment[index].tag_list} tags.`;
                            }
                            msgSendBack += ` Do it and try again.`;
                            break;
                        case ('not_enough_mentions'):
                            msgSendBack = `I see your retweet of ${toRetweet}.`;
                            if (minMentions > 0) {
                                msgSendBack += ` To meet the Bounty campaign rules, mention at least ${minMentions} friends.`;
                            }
                            msgSendBack += ` Do it and try again.`;
                            break;	
                        case ('no_hashtags'):
                            msgSendBack = `I see your retweet of ${toRetweet}.`;
                            if (hashtags.length > 0) {
                                msgSendBack += ` To meet the Bounty campaign rules, use ${config.twitter_retweet_w_comment[index].tag_list} tags.`;
                            }
                            msgSendBack += ` Do it and try again.`;
                            break;
                        default:
                            break;
                    }

                    await $u.sendAdmMsg(userId, msgSendBack);
                    log.info(`User ${userId}.. ${twitterAccount} did NOT retweet ${toRetweet}: ${retweetResult.error}. Message to user: ${msgSendBack}`);

                    break;
                }
            }
            await user.update({
                isTwitterRetweetCommentCheckPassed: isRetweeted
            }, true);
    
		} catch (e) {
			log.error(`Error in ${$u.getModuleName(module.id)} module: ${e}`);
        }
        
	});

};

if (config.twitter_retweet_w_comment.length > 0)
    setInterval(() => {
        module.exports();
    }, 15 * 1000);
