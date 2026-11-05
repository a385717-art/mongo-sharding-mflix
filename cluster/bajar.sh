#!/usr/bin/env bash
# Apaga el cluster. Los datos se quedan en los volumenes.
# Con --borrar-todo tambien borra los volumenes (para empezar de cero)
cd "$(dirname "$0")"
if [ "$1" = "--borrar-todo" ]; then
  docker compose down -v
else
  docker compose down
fi
