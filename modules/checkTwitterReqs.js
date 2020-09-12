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
            let result, isEligible;

            if (config.doCheckTwitterReqs) {
                result = await twitterapi.checkIfAccountEligible(twitterAccount);
                if (result.error === 'request_failed') return;
                console.log(result);
                isEligible = result.success;
            } else {
                isEligible = true;
            }

            if (isEligible) {
                console.log(`User ${userId}.. ${twitterAccount} is eligible.`);

            } else {
                console.log(`User ${userId}.. ${twitterAccount} is NOT eligible.`);
                await user.update({
                    isTwitterAccountEligible: false,
                    isInCheck: false,
                    isTasksCompleted: false
                }, true);
                msgSendBack = `To meet the Bounty campaign rules, your Twitter account ${config.twitterEligibleString}.`;
                await $u.sendAdmMsg(userId, msgSendBack);
            }
            
            await user.update({
                isTwitterAccountEligible: isEligible,
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
