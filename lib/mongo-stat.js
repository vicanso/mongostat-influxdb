const mongoose = require('mongoose');
const EventEmitter = require('events');
const _ = require('lodash');

mongoose.Promise = Promise;
const MB = 1024 * 1024;
const million = 1000 * 1000;

class MongoStats extends EventEmitter {
  constructor(uri, options) {
    super();
    /* istanbul ignore if */
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
      /* istanbul ignore next */
      if (this.listenerCount('error')) {
        this.emit('error', err);
      }
    });
    this.admin = connection.db.admin();
  }
  runStat() {
    return this.admin.serverStatus().then((data) => {
      const keys = [
        'connections',
        'globalLock',
        'locks',
        'network',
        'opLatencies',
        'opcounters',
        'mem',
        'opcountersRepl',
      ];
      return _.pick(data, keys);
    });
  }
  getStat(data) {
    const prevStat = this.prevStat;
    const getConnections = () => {
      const connections = data.connections;
      const total = connections.current + connections.available;
      return {
        current: connections.current,
        usage: Math.round((100 * connections.current) / total),
      };
    };

    const getGlobalLock = () => {
      const {
        currentQueue,
        activeClients,
      } = data.globalLock;
      return {
        queueReaders: currentQueue.readers,
        queueWriters: currentQueue.writers,
        activeClientsReaders: activeClients.readers,
        activeClientsWriters: activeClients.writers,
      };
    };

    const getLocks = () => {
      const prevLocks = prevStat.locks;
      const result = {};
      _.forEach(data.locks, (v1, k1) => {
        _.forEach(v1, (v2, k2) => {
          _.forEach(v2, (v3, k3) => {
            const v = v3 - prevLocks[k1][k2][k3];
            const name = _.camelCase(`${k1} ${k2} ${k3}`);
            result[name] = v;
          });
        });
      });
      return result;
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
      locks: getLocks(),
      network: getNetwork(),
      opcounters: getOpcounters(),
      mem: _.pick(data.mem, ['resident', 'virtual']),
      opcountersRepl: getOpcountersRepl(),
      opLatencies: getOpLatencies(),
    };
  }
  start(interval) {
    return setInterval(() => {
      this.runStat().then((data) => {
        if (this.prevStat) {
          this.emit('stat', this.getStat(data));
        }
        this.prevStat = data;
      }).catch((err) => {
        /* istanbul ignore if */
        if (this.listenerCount('error')) {
          this.emit('error', err);
        }
      });
    }, interval);
  }
}

module.exports = MongoStats;
