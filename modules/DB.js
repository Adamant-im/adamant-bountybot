const MongoClient = require('mongodb').MongoClient;
const mongoClient = new MongoClient('mongodb://localhost:27017/', {useNewUrlParser: true, useUnifiedTopology: true});
const model = require('../helpers/dbModel');

const collections = {};

mongoClient.connect((err, client) => {
  if (err) {
    throw (err);
  }
  const db = client.db('bountybotdb');
  collections.db = db;
  collections.systemDb = model(db.collection('systems'));
  collections.IncomingTxsDb = model(db.collection('incomingtxs'));
  collections.UsersDb = model(db.collection('users'));
  collections.PaymentsDb = model(db.collection('payments'));
});

module.exports = collections;
