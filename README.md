# mongostat-influxdb

Get mongo stat and insert into influxdb

## Installation

```bash
$ npm install mongostat-influxdb -g
```

## Run

```bash
mongostat-influxdb -c ./config.yml
```

## Config

```
interval: 10000
influx: http://127.0.0.1:8086/test
mongo:
  -
    name: my-mongo
    uri: mongodb://127.0.0.1:27017/admin
  -
    name: rpl-mongo
    uri: mongodb://user:pass@127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/admin?replicaSet=test
```

## License

MIT
