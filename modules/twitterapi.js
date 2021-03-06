const $u = require('../helpers/utils');
const log = require('../helpers/log');
const config = require('./configReader');
const Twitter = require('twitter')({
    consumer_key: config.twitter_api.consumer_key,
    consumer_secret: config.twitter_api.consumer_secret,
    access_token_key: config.twitter_api.access_token_key,
    access_token_secret: config.twitter_api.access_token_secret
  });

let toFollowIds = {};

(async function() {

  // Get Twitter accounts-to-follow ids by their names

  let name, id;
  for (let i = 0; i < config.twitter_follow.length; i++) {
    name = $u.getTwitterScreenName(config.twitter_follow[i]);
    id = (await getAccountInfo(config.twitter_follow[i])).id_str;
    if (id) {
      toFollowIds[name] = id;
    } else {
      log.error(`Unable to get Twitter ids of accounts to follow. Cannot start Bot.`);
      process.exit(1);
    }
  }

})();


async function getAccountFollowerIds(account) {
  const accountSN = $u.getTwitterScreenName(account);
  console.log(`Getting followers for @${accountSN}..`)

  var ids = [];
  return new Promise((resolve, reject) => {
    Twitter.get('followers/ids', {screen_name: accountSN, count: 5000, stringify_ids: true}, function getData(error, data, response) {
      try {
        if (error) {
          log.warn(`Twitter returned an error in getAccountFollowerIds(): ${JSON.stringify(error)}`);
          resolve(false);
        } else {
          ids = ids.concat(data.ids);
          // console.log(`next_cursor_str: `, data['next_cursor_str']);
          if (data['next_cursor_str'] > 0) {
            Twitter.get('followers/ids', { screen_name: accountSN, count: 5000, cursor: data['next_cursor_str'] }, getData);
          } else {
            console.log(`FollowerIds count for @${accountSN} is ${ids.length}.`);
            resolve(ids);
          }
        }
      } catch (e) { 					
        log.warn(`Error while making getAccountFollowerIds() request: ${JSON.stringify(e)}`);
        resolve(false);
      };
    });
  });

}

async function getAccountFriendIds(account) {
  const accountSN = $u.getTwitterScreenName(account);
  console.log(`Getting friends for @${accountSN}..`)

  var ids = [];
  return new Promise((resolve, reject) => {
    Twitter.get('friends/ids', {screen_name: accountSN, count: 5000, stringify_ids: true}, function getData(error, data, response) {
      try {
        if (error) {
          log.warn(`Twitter returned an error in getAccountFriendIds(): ${JSON.stringify(error)}`);
          resolve(false);
        } else {
          ids = ids.concat(data.ids);
          // console.log(`next_cursor_str: `, data['next_cursor_str']);
          if (data['next_cursor_str'] > 0) {
            Twitter.get('friends/ids', { screen_name: accountSN, count: 5000, cursor: data['next_cursor_str'] }, getData);
          } else {
            console.log(`FriendIds count for @${accountSN} is ${ids.length}.`);
            resolve(ids);
          }
        }
      } catch (e) { 					
        log.warn(`Error while making getAccountFriendIds() request: ${JSON.stringify(e)}`);
        resolve(false);
      };
    });
  });

}

async function getAccountTimeline(account) {
  const accountSN = $u.getTwitterScreenName(account);
  console.log(`Getting timeline for @${accountSN}..`)

  return await Twitter.get('statuses/user_timeline', {screen_name: accountSN, count: 10, trim_user: true, tweet_mode: 'extended'})
    .then(function (data) {
      // console.log(`Timeline for @${accountSN}:`);
      // console.log(data);

      console.log(`Timeline count for @${accountSN} is ${data.length}.`);
      return data;
    })
    .catch(function (e) {
      log.warn(`Error while making getAccountTimeline() request: ${JSON.stringify(e)}`);
      return false;
    });

}

async function getAccountInfo(account) {
  const accountSN = $u.getTwitterScreenName(account);
  // console.log(`Getting user info for @${accountSN}..`)

  return await Twitter.get('users/show', {screen_name: accountSN})
    .then(function (data) {
      // console.log(`User info for @${accountSN}:`);
      // console.log(data);
      return data;
    })
    .catch(function (e) {
      log.warn(`Error while making getAccountInfo() request: ${JSON.stringify(e)}`);
      return false;
    });

}


module.exports = {

  async testApi() {

    let testResult = {
      success: false,
      message: ""
    }

    try {

      const testAccount = "@TwitterDev";
      let result = await getAccountInfo(testAccount);

      if (result && result.id_str === '2244994945') {
        testResult.success = true;
      } else {
        testResult.success = false;
        testResult.message = "Request *users/show* for @TwitterDev didn't return expected value.";
      }
      return testResult;

    } catch (e) {
      testResult.success = false;
      testResult.message = "Exception while making *users/show* request."; 
      return testResult;
    }

  },
  // Search for predefined toFollowIds — save Twitter API requests
  // followAccount should be in "twitter_follow" param in config
  async checkIfAccountFollowing(twitterAccount, followAccount) {

    const twitterAccountSN = $u.getTwitterScreenName(twitterAccount);
    const followAccountSN = $u.getTwitterScreenName(followAccount);
    console.log(`Checking if @${twitterAccountSN} follows @${followAccountSN}..`);

    let followers = await getAccountFriendIds(twitterAccountSN);
    // console.log(followers);    
    return followers.includes(toFollowIds[followAccountSN]);
  },
  async checkIfAccountRetweetedwComment(twitterAccount, tweet, minMentions, hashtags) {

    const twitterAccountSN = $u.getTwitterScreenName(twitterAccount);
    const tweetId = $u.getTweetIdFromLink(tweet);
    hashtags = $u.getTwitterHashtags(hashtags);
    console.log(tweetId);
    console.log(`Checking if @${twitterAccountSN} retweeted ${tweet}..`)

    let tweets = await getAccountTimeline(twitterAccountSN);
    let retweet = {};
    for (let i = 0; i < tweets.length; i++) {
      if (tweets[i].quoted_status && tweets[i].quoted_status.id_str === tweetId) {
        retweet = tweets[i];
        break;
      }
    }
    if (Object.keys(retweet).length < 1) { // Empty object
      return {
        success: false,
        error: 'no_retweet'
      }
    }
    if (retweet.entities.user_mentions.length < minMentions) {
      return {
        success: false,
        error: 'not_enough_mentions'
      }
    }
    let retweet_hashtags = [];
    for (let i = 0; i < retweet.entities.hashtags.length; i++) {
      retweet_hashtags[i] = retweet.entities.hashtags[i].text.toLowerCase();
    }
    for (let i = 0; i < hashtags.length; i++) {
      if (!retweet_hashtags.includes(hashtags[i].toLowerCase())) {
        return {
          success: false,
          error: 'no_hashtags'
        }
      }
    }

    return {
      success: true,
      error: ''
    }

  }

}