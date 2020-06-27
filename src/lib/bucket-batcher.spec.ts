import { createBucketBatcher } from './bucket-batcher';

const asyncSleep = n =>
  new Promise((resolve, _reject) => setTimeout(resolve, n));

describe('bucket batcher', () => {
  test('it shouldnt fill up more than the bucket size', async () => {
    const mock = jest.fn();
    let calledWithBatchSize;

    const bucketBatcher = createBucketBatcher({
      bucketSize: 3,
      maxFlushInterval: 200,
      handleBatch: batch => {
        calledWithBatchSize = batch.length;
        mock();
      }
    });

    new Array(4).fill(null).forEach(_ => {
      bucketBatcher.push('a');
    });

    expect(mock).toHaveBeenCalled();
    expect(calledWithBatchSize).toBe(3);

    await asyncSleep(250);
    expect(calledWithBatchSize).toBe(1);

    bucketBatcher.teardown();
  });

  test('it shouldnt wait longer than the flush interval', async () => {
    const mock = jest.fn();

    const bucketBatcher = createBucketBatcher({
      bucketSize: 10,
      maxFlushInterval: 200,
      handleBatch: mock
    });

    bucketBatcher.push('a');
    await asyncSleep(250);
    expect(mock).toHaveBeenCalled();

    bucketBatcher.teardown();
  });

  test('it shouldnt flush too early', async () => {
    const mock = jest.fn();

    const bucketBatcher = createBucketBatcher({
      bucketSize: 10,
      maxFlushInterval: 200,
      handleBatch: mock
    });

    bucketBatcher.push('a');
    await asyncSleep(50);
    expect(mock).not.toHaveBeenCalled();

    bucketBatcher.teardown();
  });
});
