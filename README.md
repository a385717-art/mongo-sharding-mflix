# MongoDB Sharding con Docker: sample_mflix

Práctica de Bases de Datos Distribuidas. Montamos un cluster de MongoDB 7.0 con sharding en Docker, cargamos la colección `movies` de `sample_mflix` y la repartimos en 3 shards con una shard key hashed sobre `id_movie`. Al final probamos operaciones CRUD a través del mongos.

## Equipo

- Ezequiel Adolfo Herrera Hernández 385717
- Diego Iván Ibarra Lozoya 373781

## Arquitectura

| Componente | Replica set | Contenedores |
|---|---|---|
| Config server | `configRS` | mflix-cfg1, mflix-cfg2, mflix-cfg3 |
| Shard 1 | `shard1` | mflix-shard1a, mflix-shard1b, mflix-shard1c |
| Shard 2 | `shard2` | mflix-shard2a, mflix-shard2b, mflix-shard2c |
| Shard 3 | `shard3` | mflix-shard3a, mflix-shard3b, mflix-shard3c |
| Router | - | mflix-mongos (puerto 27117 en la compu) |

Son 13 contenedores y cada replica set tiene 1 primary y 2 secondary. Solo el mongos está publicado hacia afuera, lo demás se comunica por la red interna `mflix-net`.

## Estructura del repo

```
.
├── README.md
├── Docker-Compose/                  # primera versión (replica sets de 1 nodo) y el json de movies
└── cluster/
    ├── docker-compose.yml
    ├── levantar.sh                  # hace todo, del paso 1 al 6
    ├── crud.sh                      # corre el CRUD y guarda evidencias
    ├── bajar.sh                     # apaga el cluster
    ├── scripts/
    │   ├── 01-iniciar-replicas.sh   # rs.initiate de los 4 replica sets
    │   ├── 02-agregar-shards.sh     # sh.addShard x3
    │   ├── 03-importar-datos.sh     # mongoimport (json) o mongodump/mongorestore (Atlas)
    │   ├── 04-agregar-id_movie.js   # id_movie secuencial
    │   ├── 05-shardear.js           # enableSharding + shardCollection
    │   ├── 06-crud.js               # operaciones CRUD
    │   └── evidencia.sh             # guarda sh.status() y getShardDistribution()
    └── evidencias/                  # salidas en .txt para el reporte
```

## Levantar y bajar

Se necesita Docker con Compose. Todo se corre desde la carpeta `cluster/`:

```bash
cd cluster
./levantar.sh              # levanta todo desde cero (tarda como 2 minutos)
./crud.sh                  # corre el CRUD
./bajar.sh                 # apaga el cluster, los datos se quedan guardados
./bajar.sh --borrar-todo   # apaga y borra los volúmenes
```

Si `levantar.sh` se corre otra vez con el cluster ya armado, no pasa nada: cada paso revisa si ya se hizo y se lo salta.

Para conectarse a mano: `mongosh --port 27117`, o sin mongosh instalado: `docker exec -it mflix-mongos mongosh`.

## Pasos en orden (lo que hace levantar.sh)

1. **Contenedores**: `docker compose up -d`
2. **Replica sets**: `./scripts/01-iniciar-replicas.sh`. Hace el `rs.initiate()` de cada replica set y espera a que haya PRIMARY.
3. **Shards**: `./scripts/02-agregar-shards.sh`
   ```js
   sh.addShard("shard1/shard1a:27017,shard1b:27017,shard1c:27017")
   ```
   y lo mismo con shard2 y shard3.
4. **Datos**: `./scripts/03-importar-datos.sh`. Por defecto usa el json exportado de Atlas (`Docker-Compose/sample_mflix.movies.json`, 21,349 películas). Para traerlos directo de Atlas, la cadena se pasa como variable de entorno y no queda guardada en ningún archivo:
   ```bash
   FORZAR=1 ATLAS_URI="mongodb+srv://usuario:pass@cluster..." ./scripts/03-importar-datos.sh
   ```
5. **id_movie**: `scripts/04-agregar-id_movie.js`. Le pone 1, 2, 3... a cada película, ordenadas por `_id`, y crea un índice único. Va antes de shardear porque `id_movie` es la shard key.
6. **Shardear**: `scripts/05-shardear.js`
   ```js
   sh.enableSharding("sample_mflix")
   db.movies.createIndex({ id_movie: "hashed" })
   sh.shardCollection("sample_mflix.movies", { id_movie: "hashed" })
   ```
7. **CRUD**: `./crud.sh`

Para correr un .js suelto: `mongosh --port 27117 scripts/06-crud.js`

## CRUD

Todo pasa por el mongos, nunca directo a un shard.

- **Create**: un `insertOne` y un `insertMany` de 10 películas nuevas. El `id_movie` sigue después del último. Para cada una se muestra en qué shard quedó, con `explain()`.
- **Read**: `find` por `id_movie`, por título y por año, y un `aggregate` con los 5 géneros con más películas.
- **Update**: `updateOne` por `id_movie` y dos `updateMany`.
- **Delete**: `deleteOne` y `deleteMany`.

Al final imprime `getShardDistribution()`. Las películas de prueba llevan `prueba: true` y, si se corre el script otra vez, se borran antes de empezar.

## Cosas que salieron en el camino

- **Todo se quedaba en un solo shard.** La colección pesa como 33 MB y el chunk por defecto es de 128 MB, así que el balancer no movía nada. Bajamos el chunk a 1 MB con `configureCollectionBalancing` y ya se repartió en unos 20 chunks, más o menos 39% / 30% / 30%. En la 7.0 el balancer reparte por tamaño de datos, por eso un shard se queda con un solo chunk grande.
- **Documentos de más en getShardDistribution.** Después de balancear salían más de 21,349 documentos porque el shard de origen tarda 15 min en borrar las copias huérfanas. Bajamos ese tiempo a 60 s con `orphanCleanupDelaySecs` y `evidencia.sh` espera a que no haya huérfanos.
- **deleteOne por título daba error.** Con la colección shardeada, la 7.0 pide que un `deleteOne` lleve la shard key o el `_id`. Lo que hicimos fue buscar primero el `id_movie` por el título y luego borrar por `id_movie`.
- **Consultas por id_movie contra consultas por título.** En el explain, las que van por `id_movie` salen `SINGLE_SHARD` (el mongos sabe a qué shard ir). Las que van por título o año salen `SHARD_MERGE`, porque le pregunta a los 3 shards.

## Evidencias

En `cluster/evidencias/`:
- `despues-de-shardear.txt`: `sh.status()` y `getShardDistribution()` recién shardeada la colección
- `salida-crud.txt`: la salida de todas las operaciones
- `despues-del-crud.txt`: `sh.status()` y `getShardDistribution()` después del CRUD

## Reporte

El reporte de la práctica (configuración, CRUD y balanceo) está en [report/Reporte_MongoDB_Sharding_mflix.pdf](report/Reporte_MongoDB_Sharding_mflix.pdf).
