const assert = require('assert');
const _ = require('lodash');

const MongoStat = require('../lib/mongo-stat');
const statData = {
  connections: {
    current: 1,
    usage: 0,
  },
  globalLock: {
    queueReaders: 0,
    queueWriters: 0,
    activeClientsReaders: 0,
    activeClientsWriters: 0,
  },
  locks: {
    globalAcquireCountR: 0,
    globalAcquireCountW: 0,
    databaseAcquireCountR: 0,
    databaseAcquireCountW: 0,
    collectionAcquireCountR: 0,
    collectionAcquireCountW: 0,
    metadataAcquireCountW: 0,
  },
  network: {
    in: 0,
    out: 0,
    numRequests: 2,
  },
  opcounters: {
    insert: 0,
    query: 0,
    update: 0,
    delete: 0,
    getmore: 0,
    command: 1,
  },
  mem: {
    resident: 59,
    virtual: 270,
  },
  opcountersRepl: {
    insert: 0,
    query: 0,
    update: 0,
    delete: 0,
    getmore: 0,
    command: 0,
  },
  opLatencies: {
    readsLatency: 0,
    readsOps: 0,
    writesLatency: 0,
    writesOps: 0,
    commandsLatency: 0,
    commandsOps: 1,
  },
};

describe('MongoStat', () => {
  it('start stat', (done) => {
    const client = new MongoStat('mongodb://127.0.0.1:37017/');
    client.once('stat', (data) => {
      _.forEach(_.keys(statData), (key) => {
        const value = data[key];
        assert(_.isObject(value));
        const tmpKeys = _.keys(statData[key]);
        _.forEach(tmpKeys, k => assert(_.isNumber(value[k])));
      });
      done();
    });
    client.start(100);
  });
});
