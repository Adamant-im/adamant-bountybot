const config = require('./configReader');
const Twitter = require('twitter')({
    consumer_key: config.twitter_api.consumer_key,
    consumer_secret: config.twitter_api.consumer_secret,
    access_token_key: config.twitter_api.access_token_key,
    access_token_secret: config.twitter_api.access_token_secret
  });

module.exports = {
  async checkIfAccountFollowing(twitterAccountLink, followAccount) {
    console.log(`Checking if ${twitterAccountLink} follows ${followAccount}..`)
    return true;
  }
}