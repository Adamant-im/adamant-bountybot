const log = require('../helpers/log');
const MongoClient = require('mongodb').MongoClient;
const mongoClient = new MongoClient('mongodb://localhost:27017/', {useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 3000});
const model = require('../helpers/dbModel');
const config = require('./configReader');

const collections = {};

mongoClient.connect((error, client) => {
  if (error) {
    log.error(`Unable to connect to MongoDB, ` + error);
    process.exit(-1);
  }
  const db = client.db('bountybotdb');
  collections.db = db;
  collections.systemDb = model(db.collection('systems'));
  collections.IncomingTxsDb = model(db.collection('incomingtxs'));
  collections.UsersDb = model(db.collection('users'));
  collections.PaymentsDb = model(db.collection('payments'));

  log.log(`${config.notifyName} successfully connected to 'bountybotdb' MongoDB.`);
});

module.exports = collections;
