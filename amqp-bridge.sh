#!/bin/bash

# Run the pg-amqp-bridge image for CI tests

GITHUB_NETWORK=$(docker network ls | grep github | awk '{ print $2 }')

./dockerize -wait tcp://localhost:5432 -timeout 30s
./dockerize -wait tcp://localhost:5672 -timeout 30s

docker create \
  --network "$GITHUB_NETWORK" \
  -e AMQP_URI="amqp://guest:guest@rabbitmq" \
  -e POSTGRESQL_URI="postgres://postgres:postgres@postgres:5432/assemble_worker_test" \
  -e DELIVERY_MODE="NON-PERSISTENT" \
  -e BRIDGE_CHANNELS="assemble_worker:assemble_worker" \
  gcr.io/assemble-services/pg-amqp-bridge-node:1.0.1
