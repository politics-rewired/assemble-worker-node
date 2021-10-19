#!/bin/bash

# Run the pg-amqp-bridge image for CI tests

docker network ls

GITHUB_NETWORK=$(docker network ls | grep github | awk '{ print $2 }')

./dockerize -wait tcp://localhost:5432 -timeout 30s
./dockerize -wait tcp://localhost:5672 -timeout 30s

docker create \
  --network "bridge" \
  --network "$GITHUB_NETWORK" \
  -e AMQP_URI="amqp://guest:guest@rabbitmq" \
  -e POSTGRESQL_URI="postgres://postgres:postgres@postgres:5432/assemble_worker_test" \
  -e DELIVERY_MODE="NON-PERSISTENT" \
  -e BRIDGE_CHANNELS="assemble_worker:assemble_worker" \
  us-east4-docker.pkg.dev/assemble-services/apps/pg-amqp-bridge:1.3.1

sleep 1
