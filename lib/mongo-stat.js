const mongoose = require('mongoose');
const EventEmitter = require('events');
const _ = require('lodash');

mongoose.Promise = Promise;
const MB = 1024 * 1024;
const million = 1000 * 1000;

class MongoStats extends EventEmitter {
  constructor(uri, options) {
    super();
    if (!uri) {
      throw new Error('The uri param can not be null');
    }
    const connection = mongoose.createConnection(uri, _.extend({
      db: {
        native_parser: true,
      },
      server: {
        poolSize: 1,
      },
    }, options));

    connection.on('connected', () => this.emit('connected'));
    connection.on('error', (err) => {
      if (this.listenerCount('error')) {
        this.emit('error', err);
      }
    });
    this.admin = connection.db.admin();
  }
  runStat() {
    return this.admin.serverStatus().then((data) => {
      const keys = 'connections globalLock locks network opLatencies opcounters mem opcountersRepl'.split(' ');
      return _.pick(data, keys);
    });
  }
  getStat(data) {
    const prevStat = this.prevStat;
    const getConnections = () => {
      const connections = data.connections;
      return {
        current: connections.current,
        usage: Math.round(100 * connections.current / connections.available),
      };
    };

    const getGlobalLock = () => {
      const currentQueue = data.globalLock.currentQueue;
      const activeClients = data.globalLock.activeClients;
      return {
        queueReaders: currentQueue.readers,
        queueWriters: currentQueue.writers,
        activeClientsReaders: activeClients.readers,
        activeClientsWriters: activeClients.writers,
      };
    };

    const getLocks = () => {

    };

    const getNetwork = () => {
      const network = data.network;
      const prevNetwork = prevStat.network;
      return {
       in: Math.round((network.bytesIn - prevNetwork.bytesIn) / MB),
       out: Math.round((network.bytesOut - prevNetwork.bytesOut) / MB),
       numRequests: network.numRequests - prevNetwork.numRequests,
     };
    };

    const getOpcounters = () => {
      const result = {};
      const prevOpcounters = prevStat.opcounters;
      _.forEach(data.opcounters, (value, key) => {
        result[key] = value - prevOpcounters[key];
      });
      return result;
    };

    const getOpcountersRepl = () => {
      const result = {};
      const prevOpcountersRepl = prevStat.opcountersRepl;
      _.forEach(data.opcountersRepl, (value, key) => {
        result[key] = value - prevOpcountersRepl[key];
      });
      return result;
    };

    const getOpLatencies = () => {
      const result = {};
      const prevOpLatencies = prevStat.opLatencies;
      _.forEach(data.opLatencies, (value, key) => {
        _.forEach(value, (v, k) => {
          const name = _.camelCase(`${key} ${k}`);
          const prev = prevOpLatencies[key][k];
          if (k === 'latency') {
            result[name] = Math.round((v - prev) / million);
          } else {
            result[name] = v - prev;
          }
        });
      });
      return result;
    };

    return {
      connections: getConnections(),
      globalLock: getGlobalLock(),
      network: getNetwork(),
      opcounters: getOpcounters(),
      mem: _.pick(data.mem, ['resident', 'virtual']),
      opcountersRepl: getOpcountersRepl(),
      opLatencies: getOpLatencies(),
    };
  }
  startStat(interval) {
    return setInterval(() => {
      this.runStat().then((data) => {
        if (this.prevStat) {
          const stat = this.getStat(data);
          console.dir(stat);
        }
        this.prevStat = data;
        // console.dir(data);
      }).catch((err) => {
        if (this.listenerCount('error')) {
          this.emit('error', err);
        }
      });
    }, interval);
  }
}

// const client = new MongoStats('mongodb://127.0.0.1/admin', {
//   replset: {
//     rs_name: 'plus',
//   },
// });
const client = new MongoStats('mongodb://127.0.0.1:27017/admin');
client.startStat(1000);
