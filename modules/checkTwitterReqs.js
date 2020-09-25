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
			{isTwitterAccountEligible: false},
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

            let msgSendBack = '';
            let result, isEligible = true;
            let twitterAccountIdStr = null;

            result = await twitterapi.checkIfAccountEligible(twitterAccount);
            // console.log(result);
            if (result.error === 'request_failed') return;
            if (result.error === 'user_not_found')
                msgSendBack = `It seems Twitter account ${twitterAccount} does not exist. Please check and try again.`
            else {
                // Check if this user already participated in Bounty campaign.
                // He may change Twitter's AccountName, but id will be the same
                twitterAccountIdStr = result.accountInfo.id_str;
                console.log('twitterAccountIdStr:', twitterAccountIdStr);
                let userDuplicate = await usersDb.findOne({twitterAccountId: twitterAccountIdStr});
                console.log('user duplicate:', userDuplicate);

                if (userDuplicate && (userDuplicate.twitterAccount !== twitterAccount)) {
                    // This user changed his AccountName
                    isEligible = false;
                    msgSendBack = `This Twitter account is already in use by other participant. Account name is changed. If it's a mistake, try again in a few minutes.`;
                }
            }

            if (config.doCheckTwitterReqs) {
                isEligible = isEligible && result.success;
            } else {
                isEligible = isEligible && true;
            }

            if (isEligible) {
                console.log(`User ${userId}.. ${twitterAccount} is eligible.`);

            } else {
                console.log(`User ${userId}.. ${twitterAccount} is NOT eligible.`);
                await user.update({
                    isTwitterAccountEligible: false,
                    twitterAccountId: twitterAccountIdStr,
                    isInCheck: false,
                    isTasksCompleted: false
                }, true);

                if (msgSendBack === '')
                    msgSendBack = `To meet the Bounty campaign rules, your Twitter account ${config.twitterEligibleString}.`;
                await $u.sendAdmMsg(userId, msgSendBack);
            }
            
            await user.update({
                isTwitterAccountEligible: isEligible,
                twitterAccountId: twitterAccountIdStr,
                twitterLifetimeDays: result.lifetimeDays,
                twitterFollowers: result.followers
            }, true);
    
		} catch (e) {
			log.error(`Error in ${$u.getModuleName(module.id)} module: ${e}`);
        }
        
	});

};

if (config.isTwitterCampaign)
    setInterval(() => {
        module.exports();
    }, 15 * 1000);
