const Store = require('../modules/Store');
const $u = require('../helpers/utils');
const config = require('./configReader');
const log = require('../helpers/log');
const notify = require('../helpers/notify');

module.exports = async (cmd, tx, itx) => {

	if (itx.isProcessed) return;
	log.info('Got new command Tx to process: ' + cmd);
	try {
		let res = [];
		const group = cmd
			.trim()
			.replace(/    /g, ' ')
			.replace(/   /g, ' ')
			.replace(/  /g, ' ')
			.split(' ');
		const methodName = group.shift().trim().toLowerCase().replace('\/', '');

		// do not process commands from non-admin accounts
		if (!config.admin_accounts.includes(tx.senderId) && admin_commands.includes(methodName)) { 
			log.warn(`${config.notifyName} received an admin command from non-admin user _${tx.senderId}_. Ignoring. Income ADAMANT Tx: https://explorer.adamant.im/tx/${tx.id}.`);
			itx.update({
				isProcessed: true,
				isNonAdmin: true
			}, true);
			if (config.notify_non_admins) {			
				$u.sendAdmMsg(tx.senderId, `I won't execute admin commands as you are not an admin. Connect with my master.`);
			}
			return;
		}

		const m = commands[methodName];
		if (m) {
			res = await m(group, tx);
		} else {
			res.msgSendBack = `I don’t know */${methodName}* command. ℹ️ You can start with **/help**.`;
		}
		if (!tx) {
			return res.msgSendBack;
		}
		if (tx) {
            itx.update({isProcessed: true}, true);
            if (res.msgNotify)
                notify(res.msgNotify, res.notifyType);
            if (res.msgSendBack)
                $u.sendAdmMsg(tx.senderId, res.msgSendBack);
        }
	} catch (e) {
		tx = tx || {};
		log.error('Error while processing command ' + cmd + ' from senderId ' + tx.senderId + '. Tx Id: ' + tx.id + '. Error: ' + e);
	}
}

function help() {

return {
	msgNotify: ``,
	msgSendBack: `${config.help_message}`,
	notifyType: 'log'
	}

}

async function rates(params) {

	let output = '';

	const coin1 = params[0].toUpperCase().trim();

	if (!coin1 || !coin1.length) {
		output = 'Please specify coin ticker or specific market you are interested in. F. e., */rates ADM*.';
		return {
			msgNotify: ``,
			msgSendBack: `${output}`,
			notifyType: 'log'
		}	
	}
	const currencies = Store.currencies;
	const res = Object
		.keys(Store.currencies)
		.filter(t => t.startsWith(coin1 + '/'))
		.map(t => {
			let p = `${coin1}/**${t.replace(coin1 + '/', '')}**`;
			return `${p}: ${currencies[t]}`;
		})
		.join(', ');

	if (!res.length) {
		output = `I can’t get rates for *${coin1}*. Made a typo? Try */rates ADM*.`;
		return {
			msgNotify: ``,
			msgSendBack: `${output}`,
			notifyType: 'log'
		}
	} else {
		output = `Global market rates for ${coin1}:
${res}.`;
	}

	return {
		msgNotify: ``,
		msgSendBack: `${output}`,
		notifyType: 'log'
	}

}

async function calc(arr) {

	if (arr.length !== 4) {
		return {
			msgNotify: ``,
			msgSendBack: 'Wrong arguments. Command works like this: */calc 2.05 BTC in USDT*.',
			notifyType: 'log'
		}
	}

	let output = '';
	const amount = +arr[0];
	const inCurrency = arr[1].toUpperCase().trim();
	const outCurrency = arr[3].toUpperCase().trim();

	if (!amount || amount === Infinity) {
		output = `It seems amount "*${amount}*" for *${inCurrency}* is not a number. Command works like this: */calc 2.05 BTC in USDT*.`;
	}
	if (!$u.isHasTicker(inCurrency)) {
		output = `I don’t have rates of crypto *${inCurrency}* from Infoservice. Made a typo? Try */calc 2.05 BTC in USDT*.`;
	}
	if (!$u.isHasTicker(outCurrency)) {
		output = `I don’t have rates of crypto *${outCurrency}* from Infoservice. Made a typo? Try */calc 2.05 BTC in USDT*.`;
	}

	let result;
	if (!output) {
		result = Store.mathEqual(inCurrency, outCurrency, amount, true).outAmount;
		if (amount <= 0 || result <= 0 || !result) {
			output = `I didn’t understand amount for *${inCurrency}*. Command works like this: */calc 2.05 BTC in USDT*.`;
		} else {
			if ($u.isFiat(outCurrency)) {
				result = +result.toFixed(2);
			}
			output = `Global market value of ${$u.thousandSeparator(amount)} ${inCurrency} equals **${$u.thousandSeparator(result)} ${outCurrency}**.`;
		}
	}

	return {
		msgNotify: ``,
		msgSendBack: `${output}`,
		notifyType: 'log'
	}

}

function version() {
	return {
		msgNotify: ``,
		msgSendBack: `I am running on _adamant-bountybot_ software version _${Store.version}_. Revise code on ADAMANT's GitHub.`,
		notifyType: 'log'
	}
}

const commands = {
	help,
	rates,
	calc,
	version
}

const admin_commands = [
	""
]