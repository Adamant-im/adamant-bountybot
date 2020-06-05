const jsonminify = require('jsonminify');
const fs = require('fs');
const log = require('../helpers/log');
const keys = require('adamant-api/helpers/keys');
const isDev = process.argv.includes('dev');
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
	adamant_notify: {
		type: String,
		default: null
	},
	slack: {
		type: String,
		default: null
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
	config.min_confirmations = 2;

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
	log.error('Error reading config: ' + e);
}

function exit(msg) {
	log.error(msg);
	process.exit(-1);
}

config.isDev = isDev;
module.exports = config;
