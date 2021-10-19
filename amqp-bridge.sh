#!/bin/bash

# Run the pg-amqp-bridge image for CI tests

GITHUB_NETWORK=$(docker network ls | grep github | awk '{ print $2 }')

dockerize -wait tcp://localhost:5432 -timeout 1m
dockerize -wait tcp://localhost:5672 -timeout 1m

docker create \
  --bridge "$GITHUB_NETWORK" \
  -e AMQP_URI="amqp://guest:guest@127.0.0.1" \
  -e POSTGRESQL_URI="postgres://postgres:postgres@127.0.0.1:5432/assemble_worker_test" \
  -e DELIVERY_MODE="NON-PERSISTENT" \
  -e BRIDGE_CHANNELS="assemble_worker:assemble_worker" \
  gcr.io/assemble-services/pg-amqp-bridge-node:1.0.1
