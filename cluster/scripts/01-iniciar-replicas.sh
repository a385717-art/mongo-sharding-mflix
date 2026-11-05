#!/usr/bin/env bash
# Inicia los 4 replica sets (configRS, shard1, shard2, shard3)
# Si ya estaban iniciados no hace nada

iniciar_rs() {
  local contenedor=$1 rs=$2 extra=$3 n1=$4 n2=$5 n3=$6

  # esperar a que el mongod responda
  until docker exec "$contenedor" mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; do
    sleep 2
  done

  docker exec "$contenedor" mongosh --quiet --eval "
    try {
      rs.status();
      print('$rs ya estaba iniciado');
    } catch (e) {
      rs.initiate({
        _id: '$rs', $extra
        members: [
          { _id: 0, host: '$n1:27017', priority: 2 },
          { _id: 1, host: '$n2:27017' },
          { _id: 2, host: '$n3:27017' }
        ]
      });
      print('$rs iniciado');
    }"
}

esperar_primary() {
  local contenedor=$1 rs=$2
  echo -n "esperando PRIMARY en $rs "
  until [ "$(docker exec "$contenedor" mongosh --quiet --eval 'db.hello().isWritablePrimary' 2>/dev/null)" = "true" ]; do
    echo -n "."
    sleep 2
  done
  echo " listo"
}

iniciar_rs mflix-cfg1    configRS "configsvr: true," cfg1    cfg2    cfg3
iniciar_rs mflix-shard1a shard1   ""                shard1a shard1b shard1c
iniciar_rs mflix-shard2a shard2   ""                shard2a shard2b shard2c
iniciar_rs mflix-shard3a shard3   ""                shard3a shard3b shard3c

esperar_primary mflix-cfg1    configRS
esperar_primary mflix-shard1a shard1
esperar_primary mflix-shard2a shard2
esperar_primary mflix-shard3a shard3
