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

    // Called strictly after isTwitterFollowCheckPassed = true to eliminate userDb collisions
    const users = await UsersDb.find({
      $and: [
        {isInCheck: true},
        {isTwitterAccountEligible: true},
        {isTwitterRetweetCheckPassed: false},
        {
          $or: [
            {isTwitterFollowCheckPassed: true},
            {$expr: {$eq: [0, config.twitter_follow.length]}},
          ],
        },
        {isTasksCompleted: false},
        {
          $or: [
            {isAdamantCheckPassed: true},
            {$expr: {$eq: [0, config.adamant_campaign.min_contacts]}},
          ],
        },
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

        let toRetweet;
        let retweetResult;
        let isRetweeted;
        for (let index = 0; index < config.twitter_retweet.length; index++) {
          toRetweet = config.twitter_retweet[index].tweet;
          retweetResult = await twitterapi.checkIfAccountRetweeted(twitterAccount, toRetweet);
          isRetweeted = retweetResult.success;

          if (isRetweeted) {
            log.log(`User ${userId}… ${twitterAccount} did retweet ${toRetweet}.`);
          } else {
            await user.update({
              isTwitterRetweetCheckPassed: false,
              isInCheck: false,
              isTasksCompleted: false,
            }, true);
            if (retweetResult.error === 'no_retweet') {
              msgSendBack = `To meet the Bounty campaign rules, you should retweet ${toRetweet}.`;
              msgSendBack += `. Then you apply again.`;
            }

            await api.sendMessageWithLog(config.passPhrase, userId, msgSendBack);
            log.log(`User ${userId}… ${twitterAccount} did NOT retweet ${toRetweet}: ${retweetResult.error}. Message to user: ${msgSendBack}`);

            break;
          }
        }
        await user.update({
          isTwitterRetweetCheckPassed: isRetweeted,
        }, true);
      } catch (e) {
        log.error(`Error in ${helpers.getModuleName(module.id)} module: ${e}`);
      }
    }
  } finally {
    inProcess = false;
  }
};

if (config.twitter_retweet.length > 0) {
  setInterval(() => {
    module.exports();
  }, 11 * 1000);
}

setInterval(() => {
  module.exports();
}, 11 * 1000);
