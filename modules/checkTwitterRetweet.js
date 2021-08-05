const db = require('./DB');
const config = require('./configReader');
const $u = require('../helpers/utils');
const log = require('../helpers/log');
const notify = require('../helpers/notify');
const twitterapi = require('./twitterapi');

let inProcess = false;

module.exports = async () => {

    if (inProcess) return;
    inProcess = true;

    try {

        const {usersDb} = db;

        // Called strictly after isTwitterFollowCheckPassed = true to eliminate userDb collisions
        const users = await usersDb.find({
            $and: [
                {isInCheck: true},
                {isTwitterAccountEligible: true},
                {isTwitterRetweetCommentCheckPassed: false},
                {$or: [
                    {isTwitterFollowCheckPassed: true},
                    {$expr: {$eq: [0, config.twitter_follow.length]}}
                ]},
                {isTasksCompleted: false},
                {$or: [
                    {isAdamantCheckPassed: true},
                    {$expr: {$eq: [0, config.adamant_campaign.min_contacts]}}
                ]}
            ]
        });
        
        for (const user of users) {
            try {
                const {
                    twitterAccount,
                    userId
                } = user;

                console.log(`Running module ${$u.getModuleName(module.id)} for user ${userId}…`);

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
                        console.log(`User ${userId}… ${twitterAccount} did retweet ${toRetweet}.`);

                    } else {

                        // const friendsExample = ['@elonmusk', '@cz_binance', '@FabriLemus7', '@crypto', '@CryptoWhale'];
                        // let friendsExampleString = '';
                        // for (let index = 0; index < friendsExample.length && index < minMentions; index++) {
                        //     friendsExampleString += friendsExample[index] + ' '
                        // }
                        // friendsExampleString = friendsExampleString.trim();

                        await user.update({
                            isTwitterRetweetCommentCheckPassed: false,
                            isInCheck: false,
                            isTasksCompleted: false
                        }, true);
                        switch (retweetResult.error) {
                            case ('no_retweet'):
                                msgSendBack = `To meet the Bounty campaign rules, you should quote (retweet with comment) ${toRetweet}.`;
                                if (minMentions > 0 && hashtags.length > 0) {
                                    msgSendBack += ` Mention ${minMentions} friends, and use ${config.twitter_retweet_w_comment[index].tag_list} tags.`;
                                } else {
                                    if (minMentions > 0) {
                                        msgSendBack += ` Mention ${minMentions} friends.`;
                                    }
                                    if (hashtags.length > 0) {
                                        msgSendBack += ` Use ${config.twitter_retweet_w_comment[index].tag_list} tags.`;
                                    }
                                }
                                msgSendBack += ` Example: _Meet the ADAMANT blockchain messenger! @elonmusk @cz_binance @FabriLemus7 #privacy #crypto #anonymity #decentralization_`;
                                msgSendBack += `. Then you apply again.`;
                                break;
                            case ('not_enough_mentions'):
                                msgSendBack = `I see your quote.`;
                                if (minMentions > 0) {
                                    msgSendBack += ` To meet the Bounty campaign rules, it should mention at least ${minMentions} friends.`;
                                    msgSendBack += ` Example: _Meet the ADAMANT blockchain messenger! @elonmusk @cz_binance @FabriLemus7 #privacy #crypto #anonymity #decentralization_`;
                                }
                                msgSendBack += `. Quote once again.`;
                                break;	
                            case ('no_hashtags'):
                                msgSendBack = `I see your quote.`;
                                if (hashtags.length > 0) {
                                    msgSendBack += ` To meet the Bounty campaign rules, it should include ${config.twitter_retweet_w_comment[index].tag_list} tags.`;
                                    msgSendBack += ` Example: _Meet the ADAMANT blockchain messenger! @elonmusk @cz_binance @FabriLemus7 #privacy #crypto #anonymity #decentralization_`;
                                }
                                msgSendBack += `. Quote once again.`;
                                break;
                            default:
                                break;
                        }

                        await $u.sendAdmMsg(userId, msgSendBack);
                        log.info(`User ${userId}… ${twitterAccount} did NOT retweet ${toRetweet}: ${retweetResult.error}. Message to user: ${msgSendBack}`);

                        break;
                    }
                }
                await user.update({
                    isTwitterRetweetCommentCheckPassed: isRetweeted
                }, true);
        
            } catch (e) {
                log.error(`Error in ${$u.getModuleName(module.id)} module: ${e}`);
            }
            
        };

    } finally {
        inProcess = false;        
    }

};

if (config.twitter_retweet_w_comment.length > 0)
    setInterval(() => {
        module.exports();
    }, 11 * 1000);

setInterval(() => {
    module.exports();
}, 11 * 1000);
