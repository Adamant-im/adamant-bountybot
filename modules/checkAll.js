const db = require('./DB');
const config = require('./configReader');
const helpers = require('../helpers/utils');
const api = require('./api');
const log = require('../helpers/log');
const notify = require('../helpers/notify');
const mathjs = require('mathjs');

let inProcess = false;

module.exports = async () => {
  if (inProcess) return;
  inProcess = true;

  try {
    const {UsersDb, PaymentsDb} = db;

    const users = await UsersDb.find({
      isInCheck: true,
      isTasksCompleted: false,
    });

    for (const user of users) {
      try {
        const {
          userId,
          isTwitterFollowCheckPassed,
          isTwitterRetweetCommentCheckPassed,
          isAdamantCheckPassed,
          twitterAccount,
          twitterFollowers,
          twitterLifetimeDays,
        } = user;

        log.log(`Running module ${helpers.getModuleName(module.id)} for user ${userId}…`);

        let msgSendBack = '';

        if (
          ((config.twitter_follow.length === 0) || isTwitterFollowCheckPassed) &&
          ((config.twitter_retweet_w_comment.length === 0) || isTwitterRetweetCommentCheckPassed) &&
          ((config.adamant_campaign.min_contacts === 0) || isAdamantCheckPassed)
        ) {
          await user.update({
            isInCheck: false,
            isTasksCompleted: true,
          }, true);
          config.rewards.forEach((reward) => {
            let amount = reward.amount;
            if (config.rewards_progression_from_twitter_followers[reward.currency] && twitterFollowers) {
              let followersCount = twitterFollowers;
              if (followersCount > config.rewards_progression_from_twitter_followers[reward.currency].limit_followers) {
                followersCount = config.rewards_progression_from_twitter_followers[reward.currency].limit_followers;
              }
              const f = config.rewards_progression_from_twitter_followers[reward.currency].func;
              amount = mathjs.evaluate(f, {followers: followersCount});
              amount = +amount.toFixed(config.rewards_progression_from_twitter_followers[reward.currency].decimals_transfer);
            }
            const payment = new PaymentsDb({
              date: helpers.unix(),
              userId,
              isPayed: false,
              isFinished: false,
              outCurrency: reward.currency,
              outAmount: amount,
              outTxid: null,
              outAddress: null,
            });
            payment.save();
          });
          if (config.notifyTasksCompleted) {
            let twitterString = '';
            if (twitterAccount) {
              twitterString += ` (${twitterAccount}`;
            }
            if (twitterFollowers) {
              twitterString += `, followers: ${twitterFollowers}`;
            }
            if (twitterLifetimeDays) {
              twitterString += `, lifetime days: ${Math.round(twitterLifetimeDays)}`;
            }
            if (twitterAccount) {
              twitterString += `)`;
            }
            notify(`${config.notifyName}: User ${userId}${twitterString} completed the Bounty tasks. Payouts are pending.`, 'log');
          }
          msgSendBack = `Great, you've completed all the tasks! Reward is coming right now!`;
          await api.sendMessageWithLog(config.passPhrase, userId, msgSendBack);
        }
      } catch (e) {
        log.error(`Error in ${helpers.getModuleName(module.id)} module: ${e}`);
      }
    }
  } finally {
    inProcess = false;
  }
};

setInterval(() => {
  module.exports();
}, 7 * 1000);
