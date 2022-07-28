const accountMock = {
  data: {
    address: '6c7704ca1ff8512f6377e6a8132ff7996e1ec193',
    token: {balance: '98592144'},
    sequence: {nonce: '21'},
    keys: {numberOfSignatures: 0, mandatoryKeys: [], optionalKeys: []},
    dpos: {delegate: [Object], sentVotes: [], unlocking: []},
  },
  meta: {},
};

const sendTxMock = 'f6eebc85deaa8be731b551adeb05625be412d6792cc11d2f83d90cb9776688d5';

module.exports = {
  accountMock,
  sendTxMock,
};
