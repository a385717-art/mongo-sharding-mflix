# MongoDB Sharding con Docker: sample_mflix

Práctica de Bases de Datos Distribuidas. Montamos un cluster de MongoDB con sharding en Docker, cargamos la colección `movies` de `sample_mflix` y la repartimos en 3 shards con una shard key hashed sobre `id_movie`. Al final probamos operaciones CRUD a través del mongos.

## Equipo

- Ezequiel Adolfo Herrera Hernández 385717
- Diego Iván Ibarra Lozoya 373781

## Estructura del repo

```
.
├── README.md
├── Docker-Compose/   # primera versión (replica sets de 1 nodo) y el json de movies
└── cluster/          # versión final: replica sets de 3 nodos, scripts, CRUD y evidencias
```

Cómo levantar la versión final: [cluster/README.md](cluster/README.md)
