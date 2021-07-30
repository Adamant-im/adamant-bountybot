const jsonminify = require('jsonminify');
const fs = require('fs');
const keys = require('adamant-api/helpers/keys');
const isDev = process.argv.includes('dev');
const mathjs = require('mathjs');

let config = {};

// Validate config fields
const fields = {
	passPhrase: {
		type: String,
		isRequired: true
	},
	node_ADM: {
		type: Array,
		isRequired: true
	},
	infoservice: {
		type: Array,
		default: ['https://info.adamant.im']
	},
	socket: {
		type: Boolean,
		default: true
	},
	ws_type: {
		type: String,
		isRequired: true
	},
	bot_name: {
		type: String,
		default: null
	},
	admin_accounts: {
		type: Array,
		default: []
	},
	adamant_notify: {
		type: String,
		default: null
	},
	twitter_follow: {
		type: Array,
		default: []
	},
	twitter_retweet_w_comment: {
		type: Array,
		default: []
	},
	twitter_reqs: {
		type: Object,
		default: { "min_followers": 0, "min_friends": 0, "min_statuses": 0, "min_days": 0 }
	},
	rewards: {
		type: Array,
		isRequired: true
	},
	rewards_progression_from_twitter_followers: {
		type: Object,
		default: {}
	},
	adamant_campaign: {
		type: Object,
		default: { "min_contacts": 0 }
	},
	twitter_api: {
		type: Object,
		default: {}
	},
	twitter_api_test_interval: {
		type: Number,
		default: 600
	},
	slack: {
		type: String,
		default: null
	},
	notifyTasksCompleted: {
		type: Boolean,
		default: true
	},
	notifyRewardReceived: {
		type: Boolean,
		default: true
	},
	welcome_string: {
		type: String,
		default: 'Hello 😊. This is a stub. I have nothing to say. If you are my master, check my config.'
	},
	help_message: {
		type: String,
		default: 'I have nothing to say. If you are my master, check my config.'
	}
};

try {
	if (isDev) {
		config = JSON.parse(jsonminify(fs.readFileSync('./config.test', 'utf-8')));
	} else {
		config = JSON.parse(jsonminify(fs.readFileSync('./config.json', 'utf-8')));
	}

	let keysPair;
	try {
		keysPair = keys.createKeypairFromPassPhrase(config.passphrase);
	} catch (e) {
		exit('Passphrase is not valid! Error: ' + e);
	}
	const address = keys.createAddressFromPublicKey(keysPair.publicKey);
	config.publicKey = keysPair.publicKey;
	config.address = address;
	config.min_confirmations = 1; // Allowing myself to hardcode here
	config.isTwitterCampaign = (config.twitter_follow.length > 0) || (config.twitter_retweet_w_comment.length > 0);
	config.doCheckTwitterReqs = config.isTwitterCampaign && ((config.twitter_reqs.min_followers > 0) || (config.twitter_reqs.min_friends > 0) || (config.twitter_reqs.min_statuses > 0) || (config.twitter_reqs.min_days > 0));
	config.twitterEligibleString = `must be older, than ${config.twitter_reqs.min_days} days, must have at least ${config.twitter_reqs.min_followers} followers, ${config.twitter_reqs.min_friends} friends, and ${config.twitter_reqs.min_statuses} tweets`;

	if (config.isTwitterCampaign && (!config.twitter_api.consumer_key || !config.twitter_api.consumer_key || !config.twitter_api.access_token_secret || !config.twitter_api.access_token_key)) {
		exit(`Bot's ${address} config is wrong. To run Twitter campaign, set Twitter API credentials (twitter_api). Cannot start Bot.`);
	}

	// Create reward list
	config.rewards_list = config.rewards
	.map(t => {
		return `${t.amount} ${t.currency}`;
	})
	.join(' + ');

	// Create reward tickers
	config.rewards_tickers = config.rewards
	.map(t => {
		return `${t.currency}`;
	})
	.join(' + ');

	// Create reward ranges
	config.rewards_range = config.rewards
	.map(t => {
		if (config.rewards_progression_from_twitter_followers[t.currency]) {

			let min_followers = 0;
			if (config.twitter_reqs.min_followers)
				min_followers = config.twitter_reqs.min_followers;
			let max_followers = 1000000000;
			if (config.rewards_progression_from_twitter_followers[t.currency].limit_followers)
				max_followers = config.rewards_progression_from_twitter_followers[t.currency].limit_followers;

			let f = config.rewards_progression_from_twitter_followers[t.currency].func;	
			let min_amount = mathjs.evaluate(f, {followers: min_followers});
			min_amount = +min_amount.toFixed(config.rewards_progression_from_twitter_followers[t.currency].decimals_show);
			let max_amount = mathjs.evaluate(f, {followers: max_followers});
			max_amount = +max_amount.toFixed(config.rewards_progression_from_twitter_followers[t.currency].decimals_show);

			return `- from ${min_amount} ${t.currency} (${min_followers} followers) to ${max_amount} ${t.currency} (${max_followers}+ followers)`;
		} else {
			return `- ${t.amount} ${t.currency}`;	
		}
	})
	.join("\n");
	
	// Process help_message as a template literal
	config.twitter_follow_list = config.twitter_follow.join(', ');
	config.twitter_retweet_w_comment.forEach(tweet => {
		tweet.tag_list = tweet.hashtags.join(', ');
	});
	config.help_message = eval('`' + config.help_message +'`');

	Object.keys(fields).forEach(f => {
		if (!config[f] && fields[f].isRequired) {
			exit(`Bot's ${address} config is wrong. Field _${f}_ is not valid. Cannot start Bot.`);
		} else if (!config[f] && config[f] != 0 && fields[f].default) {
			config[f] = fields[f].default;
		}
		if (config[f] && fields[f].type !== config[f].__proto__.constructor) {
			exit(`Bot's ${address} config is wrong. Field type _${f}_ is not valid, expected type is _${fields[f].type.name}_. Cannot start Bot.`);
		}
	});

} catch (e) {
	console.error('Error reading config: ' + e);
}

function exit(msg) {
	console.error(msg);
	process.exit(-1);
}

config.isDev = isDev;
module.exports = config;
