#!/bin/bash

# Run the pg-amqp-bridge image for CI tests

docker network ls

GITHUB_NETWORK=$(docker network ls | grep github | awk '{ print $2 }')

./dockerize -wait tcp://localhost:5432 -timeout 30s
./dockerize -wait tcp://localhost:5672 -timeout 30s

docker run \
  --detach \
  --name  "amqp-bridge" \
  --network "$GITHUB_NETWORK" \
  --env AMQP_URI="amqp://guest:guest@rabbitmq" \
  --env POSTGRESQL_URI="postgres://postgres:postgres@postgres:5432/assemble_worker_test" \
  --env DELIVERY_MODE="NON-PERSISTENT" \
  --env BRIDGE_CHANNELS="assemble_worker:assemble_worker" \
  us-east4-docker.pkg.dev/assemble-services/apps/pg-amqp-bridge:1.3.2

sleep 1
