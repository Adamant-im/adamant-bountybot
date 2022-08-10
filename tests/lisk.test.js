const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const LskCoin = require('../helpers/cryptos/lsk_utils');
const config = require('../modules/configReader');

const {
  accountMock,
  sendTxMock,
} = require('./lisk.mock');

let lsk_utils = null;

const lskNode = config.node_LSK[0];

function createClient(url) {
  const client = axios.create({baseURL: url});
  client.interceptors.response.use(null, (error) => {
    if (error.response && Number(error.response.status) >= 500) {
      console.error(`Request to ${url} failed.`, error);
    }
    if (error.response && Number(error.response.status) === 404) {
      if (error.response?.data?.errors[0]?.message && error.response.data.errors[0].message.includes('was not found')) {
        return error.response;
      }
    }
    return Promise.reject(error);
  });
  return client;
}

jest.setTimeout(20000);

beforeAll(async () => {
  lsk_utils = new LskCoin('LSK');
  const axiosClient = createClient(lskNode);
  const axiosMock = new MockAdapter(axiosClient, {onNoMatch: 'passthrough'});
  lsk_utils.clients[lskNode] = axiosClient;
  axiosMock.onGet(`${lskNode}/api/accounts/${lsk_utils.account.addressHex}`, accountMock);
  axiosMock.onPost(`${lskNode}/api/transactions`, sendTxMock);
});

test('Should return user\'s balance', async () => {
  const balance = await lsk_utils.updateBalance();
  return expect(balance).toEqual(expect.any(Number));
});

test('Should return last block height', async () => {
  const height = await lsk_utils.getLastBlockHeight();
  return expect(height).toEqual(expect.any(Number));
});

test('Should return transaction status', async () => {
  const txId = 'c3e38a305d9417137b3d888132f34669cb1d2dc401c2b5148790104ecbe1840e';
  const tx = await lsk_utils.getTransactionStatus(txId);
  return expect(tx).toEqual(expect.objectContaining({
    blockNumber: expect.any(Number),
    status: expect.any(Boolean),
  }));
});

test('Send transaction', async () => {
  const result = await lsk_utils.send({
    address: 'lsk4nwbk8w3qejknyff87to6ututyso6pzxavpant',
    value: 0.01,
    comment: 'Was it great? Share the experience with your friends!', // if ADM
  });
  return expect(result).toEqual(expect.objectContaining({
    success: expect.any(Boolean),
    hash: expect.any(String),
  }));
});
