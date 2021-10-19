#!/bin/bash

# Run the pg-amqp-bridge image for CI tests

echo "waiting for postgres"
while ! nc -z postgres 5432; do
  echo "sleeping 1s" && sleep 1
done
echo "waiting for rabbitmq"
while ! nc -z rabbitmq 5672; do
  echo "sleeping 1s" && sleep 1
done

docker create \
  --link \
  -e AMQP_URI="amqp://guest:guest@rabbitmq" \
  -e POSTGRESQL_URI="postgres://postgres:postgres@postgres:5432/assemble_worker_test" \
  -e DELIVERY_MODE="NON-PERSISTENT" \
  -e BRIDGE_CHANNELS="assemble_worker:assemble_worker" \
  gcr.io/assemble-services/pg-amqp-bridge-node:1.0.1