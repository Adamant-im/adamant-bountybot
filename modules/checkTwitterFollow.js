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
			{isTwitterFollowCheckPassed: false},
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
            
            let followAccount;
            let isFollowing;
            for (let index = 0; index < config.twitter_follow.length; index++) {
                followAccount = config.twitter_follow[index];
                isFollowing = await twitterapi.checkIfAccountFollowing(twitterAccount, followAccount);
                console.log('isFollowing:', isFollowing);

                if (isFollowing) {
                    console.log(`User ${userId}.. ${twitterAccount} do follows ${followAccount}.`);

                } else {

                    await user.update({
                        isTwitterFollowCheckPassed: false,
                        isInCheck: false,
                        isTasksCompleted: false
					}, true);
                    msgSendBack = `To meet the Bounty campaign rules, you should follow Twitter account ${followAccount}. Then you apply again.`;
                    await $u.sendAdmMsg(userId, msgSendBack);
                    log.log(`User ${userId}.. ${twitterAccount} do NOT follows ${followAccount}. Message to user: ${msgSendBack}`);
                    break;
                }
            }
            await user.update({
                isTwitterFollowCheckPassed: isFollowing
            }, true);
    
		} catch (e) {
			log.error(`Error in ${$u.getModuleName(module.id)} module: ${e}`);
        }
        
	});

};

if (config.twitter_follow.length > 0)
    setInterval(() => {
        module.exports();
    }, 10 * 1000);
