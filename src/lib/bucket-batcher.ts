interface BucketBatcherOpts<T> {
  bucketSize: number;
  maxFlushInterval: number;
  handleBatch: (items: T[]) => any;
}

export const createBucketBatcher = <T>(opts: BucketBatcherOpts<T>) => {
  const { bucketSize, maxFlushInterval, handleBatch } = opts;

  let bucket: T[] = [];

  const timer = setInterval(() => {
    if (bucket.length > 0) {
      handleBatch(bucket.slice());
      bucket = [];
    }
  }, maxFlushInterval);

  return {
    push: (item: T) => {
      bucket.push(item);
      if (bucket.length >= bucketSize) {
        handleBatch(bucket.slice());
        bucket = [];
      }
    },
    teardown: () => {
      clearInterval(timer);
    }
  };
};
