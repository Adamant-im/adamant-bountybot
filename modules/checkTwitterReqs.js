const db = require('./DB');
const config = require('./configReader');
const helpers = require('../helpers/utils');
const api = require('./api');
const log = require('../helpers/log');
const twitterapi = require('./twitterapi');

let inProcess = false;

module.exports = async () => {
  if (inProcess) return;
  inProcess = true;

  try {
    const {UsersDb} = db;

    const users = await UsersDb.find({
      $and: [
        {isInCheck: true},
        {isTwitterAccountEligible: false},
        {isTasksCompleted: false},
        {$or: [
          {isAdamantCheckPassed: true},
          {$expr: {$eq: [0, config.adamant_campaign.min_contacts]}},
        ]},
      ],
    });

    for (const user of users) {
      try {
        const {
          twitterAccount,
          userId,
        } = user;

        log.log(`Running module ${helpers.getModuleName(module.id)} for user ${userId}…`);

        let msgSendBack = '';
        let isEligible = true;
        let twitterAccountIdStr = null;

        const result = await twitterapi.checkIfAccountEligible(twitterAccount);

        if (result.error === 'request_failed') {
          return; // If request to Twitter API failed, ignore and check next time
        }

        if (result.error === 'user_not_found') {
          msgSendBack = `It seems Twitter account ${twitterAccount} does not exist. Please re-check and try again.`;
        } else {
          // Check if this user already participated in Bounty campaign.
          // He may change Twitter's AccountName (screen name) to cheat, but Id will be the same
          twitterAccountIdStr = result.accountInfo.id_str;
          const userDuplicate = await UsersDb.findOne({twitterAccountId: twitterAccountIdStr});
          if (userDuplicate && (userDuplicate.twitterAccount !== twitterAccount) && (userDuplicate.isInCheck || userDuplicate.isTasksCompleted)) {
            // This user changed his AccountName (screen name)
            isEligible = false;
            msgSendBack = `This Twitter account is already in use by other participant with other account name: ${userDuplicate.twitterAccount}. Cheating detected. If it's a mistake, try again in a few minutes.`;
          }
        }

        if (config.doCheckTwitterReqs) {
          isEligible = isEligible && result.success;
        } else {
          isEligible = isEligible && true;
        }

        if (isEligible) {
          log.log(`User ${userId}… ${twitterAccount} is eligible.`);
        } else {
          await user.update({
            isInCheck: false,
            isTasksCompleted: false,
          }, true);

          if (msgSendBack === '') {
            msgSendBack = `To meet the Bounty campaign rules, your Twitter account ${config.twitterEligibleString}.`;
          }

          await api.sendMessageWithLog(config.passPhrase, userId, msgSendBack);
          log.log(`User ${userId}… ${twitterAccount} is NOT eligible. Message to user: ${msgSendBack}`);
        }

        await user.update({
          isTwitterAccountEligible: isEligible,
          twitterAccountId: twitterAccountIdStr,
          twitterLifetimeDays: result.lifetimeDays,
          twitterFollowers: result.followers,
        }, true);
      } catch (e) {
        log.error(`Error in ${helpers.getModuleName(module.id)} module: ${e}`);
      }
    }
  } finally {
    inProcess = false;
  }
};

if (config.isTwitterCampaign) {
  setInterval(() => {
    module.exports();
  }, 9 * 1000);
}
