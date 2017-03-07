const yaml = require('js-yaml');
const fs = require('fs');
const _ = require('lodash');
const Influx = require('influxdb-nodejs');

const MongoStat = require('./lib/mongo-stat');
const schema = require('./lib/schema');

function readFile(file) {
  return new Promise((resolve, reject) => fs.readFile(file, (err, buf) => {
    if (err) {
      reject(err);
    } else {
      resolve(buf);
    }
  }));
}

function start(config) {
  return readFile(config).then((buf) => {
    const data = yaml.load(buf);
    const mongos = _.isArray(data.mongo) ? data.mongo : [data.mongo];
    const influx = new Influx(data.influx);
    const measurement = 'mongo-stat';
    influx.schema(measurement, schema);
    _.forEach(mongos, (mongo) => {
      const client = new MongoStat(mongo.uri);
      client.on('stat', (statData) => {
        _.forEach(statData, (fields, category) => {
          influx.write('mongo-stat')
            .field(fields)
            .tag({
              name: mongo.name,
              category,
            })
            .queue();
        });
        /* eslint no-console:0 */
        influx.syncWrite().catch(console.error);
      });
      /* eslint no-console:0 */
      client.on('error', console.error);
      client.start(data.interval || 10 * 1000);
    });
  });
}

exports.start = start;
exports.MongoStat = MongoStat;
