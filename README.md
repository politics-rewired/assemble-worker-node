# assemble-worker

docker run --rm -it --net=host -e POSTGRESQL_URI="postgres://benpacker@docker.for.mac.host.internal/assemble_worker_test" -e AMQP_URI="amqp://docker.for.mac.host.internal//" -e BRIDGE_CHANNELS="assemble_worker:assemble_worker" subzerocloud/pg-amqp-bridge
