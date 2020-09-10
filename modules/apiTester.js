const config = require('./configReader');
const log = require('../helpers/log');
const notify = require('../helpers/notify');
const twitterapi = require('./twitterapi');

async function testTwitterAPI() {
    let testResult = await twitterapi.testApi();
    let output;
    if (testResult.success) {
        output = "Twitter API functions well.";
        log.info(output);
    } else {
        output = `Error while making Twitter API request: ${testResult.message}`;
        output += "\n";
        output += `Make sure Twitter didn't block your API credentials. If so, you need to manually login into your Twitter account and solve captcha.`;
        notify(output, 'error');
    }
}

if (config.twitter_api_test_interval) {
    setInterval(() => {
        testTwitterAPI();
    }, config.twitter_api_test_interval * 60 * 1000);
}
