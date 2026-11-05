# MongoDB Sharding con Docker: sample_mflix

Práctica de **Bases de Datos Distribuidas** (Bases de Datos Avanzadas). Se monta un cluster de MongoDB con sharding sobre Docker, se carga la colección `movies` de la base `sample_mflix`, se define un shard key de tipo **hashed** sobre `id_movie`, y se prueban operaciones CRUD y balanceo de carga entre shards.

**Equipo:** 
Ezequiel Adolfo Herrera Hernandez 385717
Diego Iván Ibarra Lozoya 373781

## Arquitectura

| Servicio | Rol | Replica set | Puerto interno | Puerto en el host |
|---|---|---|---|---|
| `configsvr` | Config server | `configReplSet` | 27017 | 28017 |
| `shard1` | Shard | `shard1ReplSet` | 27018 | 28018 |
| `shard2` | Shard | `shard2ReplSet` | 27019 | 28019 |
| `shard3` | Shard | `shard3ReplSet` | 27021 | 28021 |
| `mongos` | Router | n/a | 27020 | 28020 |

Cada nodo es un replica set de un solo miembro. Los clientes se conectan siempre a `mongos`, que consulta al config server y manda las operaciones al shard correspondiente.

## Requisitos

- Docker y Docker Compose
- El archivo `sample_mflix.movies.json` (exportación de la colección, 21,349 documentos, ~41 MB).

## Estructura del repo

```
.
├── README.md
├── Docker-Compose/            # docker-compose.yml
└── Reporte/                   # reporte de la práctica y capturas
```


## Cómo levantar el cluster

Todos los comandos se corren desde la carpeta que contiene el `docker-compose.yml`.

### 1. Levantar los contenedores

```bash
docker compose up -d
docker compose ps
```

Si marca conflicto de nombres de contenedor, es que quedaron contenedores de otra práctica con el mismo nombre (`docker ps -a`). Hay que borrarlos con `docker rm -f` o cambiar los `container_name`.

### 2. Inicializar los replica sets

```bash
docker exec configsvr mongosh --port 27017 --eval 'rs.initiate({_id:"configReplSet",configsvr:true,members:[{_id:0,host:"configsvr:27017"}]})'
docker exec shard1 mongosh --port 27018 --eval 'rs.initiate({_id:"shard1ReplSet",members:[{_id:0,host:"shard1:27018"}]})'
docker exec shard2 mongosh --port 27019 --eval 'rs.initiate({_id:"shard2ReplSet",members:[{_id:0,host:"shard2:27019"}]})'
docker exec shard3 mongosh --port 27021 --eval 'rs.initiate({_id:"shard3ReplSet",members:[{_id:0,host:"shard3:27021"}]})'
```

Verificar que cada nodo quede como `PRIMARY` (tarda unos segundos):

```bash
docker exec shard1 mongosh --port 27018 --eval 'rs.status().members[0].stateStr'
```

### 3. Reiniciar mongos

```bash
docker compose restart mongos
```

### 4. Agregar los shards

```bash
docker exec -it mongos mongosh --port 27020
```

```js
sh.addShard("shard1ReplSet/shard1:27018")
sh.addShard("shard2ReplSet/shard2:27019")
sh.addShard("shard3ReplSet/shard3:27021")
sh.status()
```

### 5. Importar los datos a través de mongos

```bash
docker cp sample_mflix.movies.json mongos:/tmp/movies.json
docker exec mongos mongoimport --port 27020 --db sample_mflix --collection movies --file /tmp/movies.json --jsonArray
```

Deben importarse 21349 documentos.

### 6. Agregar `id_movie` a cada documento

Debe hacerse **antes** de definir el shard key, porque todos los documentos necesitan el campo.

```js
use sample_mflix

let contador = 1
db.movies.find().forEach(function(doc) {
  db.movies.updateOne(
    { _id: doc._id },
    { $set: { id_movie: contador } }
  )
  contador++
})
```

Verificación (debe dar 0):

```js
db.movies.countDocuments({ id_movie: { $exists: false } })
```

### 7. Definir el shard key hashed

```js
db.movies.createIndex({ id_movie: "hashed" })
sh.enableSharding("sample_mflix")
sh.shardCollection("sample_mflix.movies", { id_movie: "hashed" })
```

El índice se crea primero porque la colección ya tiene datos.

## Balanceo de carga entre shards

Con la colección recién shardeada, todos los documentos quedan en un solo chunk dentro de un solo shard. Como el dataset pesa ~33 MB y MongoDB parte los chunks a los 128 MB, el balanceador no tiene nada que mover. Para forzar el reparto en la demostración:

```js
// Bajar el chunk size de esta colección a 1 MB
db.adminCommand({ configureCollectionBalancing: "sample_mflix.movies", chunkSize: 1 })

// Partir el chunk en varios
for (let i = 1; i <= 20000; i += 2000) {
  sh.splitFind("sample_mflix.movies", { id_movie: i })
}

// Confirmar que el balanceador está activo
sh.getBalancerState()
```

Después de unos minutos, los chunks se reparten entre los tres shards.

**Resultado observado:**

- Antes: `shard3` con 100 % de los datos y 1 chunk.
- Después: datos repartidos en los tres shards (≈ 38 % / 32 % / 30 % en data) y 27 chunks.


> Mientras el balanceador migra chunks, `getShardDistribution()` puede mostrar más de 21,349 documentos en total. Son copias huérfanas que el shard de origen borra en segundo plano (por defecto a los 15 minutos). El conteo real se ve con `db.movies.countDocuments()` o con:
>
> ```js
> db.getSiblingDB("admin").aggregate([
>   { $shardedDataDistribution: {} },
>   { $match: { ns: "sample_mflix.movies" } }
> ])
> ```

## Monitoreo de la distribución

Después de cada operación CRUD se revisa cómo quedan los documentos entre los shards:

```js
db.movies.getShardDistribution()
sh.status()
```

## Operaciones CRUD

_(Sección a completar: para cada operación, el comando usado, el resultado y la captura de `getShardDistribution()` posterior.)_

- Inserción
- Consulta
- Actualización
- Eliminación

## Reporte

_(Enlace o ruta al reporte de la práctica.)_
