const notify = require('./helpers/notify');
const db = require('./modules/DB');
const Store = require('./modules/Store');
const checker = require('./modules/checkerTransactions');
const doClearDB = process.argv.includes('clear_db');
const config = require('./modules/configReader');
const txParser = require('./modules/incomingTxsParser');

// Socket connection
const api = require('./modules/api');
api.socket.initSocket({socket: config.socket, wsType: config.ws_type, onNewMessage: txParser, admAddress: Store.user.ADM.address});

setTimeout(init, 5000);

function init() {
  require('./helpers/cryptos/erc20_utils');
  require('./server');
  require('./modules/checkTwitterFollow');
  require('./modules/apiTester');
  require('./modules/checkTwitterReqs');
  require('./modules/checkTwitterRetweet');
  require('./modules/checkTwitterRetweetwComment');
  require('./modules/checkAdamantContacts');
  require('./modules/checkAll');
  require('./modules/outAddressFetcher');
  require('./modules/rewardsPayer');
  require('./modules/sentTxValidator');
  try {
    if (doClearDB) {
      console.log('Clearing database…');
      db.systemDb.db.drop();
      db.IncomingTxsDb.db.drop();
      db.UsersDb.db.drop();
      db.PaymentsDb.db.drop();
      notify(`*${config.notifyName}: database cleared*. Manually stop the Bot now.`, 'info');
    } else {
      db.systemDb.findOne().then((system) => {
        if (system) {
          Store.lastBlock = system.lastBlock;
        } else { // if 1st start
          Store.updateLastBlock();
        }
        checker();
        notify(`*${config.notifyName} started* for address _${Store.user.ADM.address}_ (ver. ${Store.version}).`, 'info');
      });
    }
  } catch (e) {
    let message = `${config.notifyName} is not started. Error: ${e}`;
    if (e.message.includes('findOne')) {
      message = `${config.notifyName} is not started. Unable to connect to MongoDB. Check if Mongo server is running and available.`;
    }
    notify(message, 'error');
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  }
}
