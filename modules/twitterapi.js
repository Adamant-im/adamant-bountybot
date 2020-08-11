const $u = require('../helpers/utils');
const config = require('./configReader');
const Twitter = require('twitter')({
    consumer_key: config.twitter_api.consumer_key,
    consumer_secret: config.twitter_api.consumer_secret,
    access_token_key: config.twitter_api.access_token_key,
    access_token_secret: config.twitter_api.access_token_secret
  });

module.exports = {
  async checkIfAccountFollowing(twitterAccount, followAccount) {

    const twitterAccountSN = $u.getTwitterScreenName(twitterAccount);
    const followAccountSN = $u.getTwitterScreenName(followAccount);
    console.log(`Checking if @${twitterAccountSN} follows @${followAccountSN}..`)


    var params = {screen_name: followAccount};
    Twitter.get('followers/list', params, function(error, tweets, response) {
      if (!error) {
        console.log(tweets);
      }
    });

    return true;
  },
  async checkIfAccountRetweetedwComment(twitterAccount, tweet) {

    const twitterAccountSN = $u.getTwitterScreenName(twitterAccount);
    console.log(`Checking if @${twitterAccountSN} retweeted ${tweet}..`)


    var params = {screen_name: followAccount, count: 30, include_rts: true, exclude_replies: true};
    Twitter.get('statuses/user_timeline', params, function(error, tweets, response) {
      if (!error) {
        console.log(tweets);
      }
    });

    return true;
  }

}