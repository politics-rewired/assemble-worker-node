/**
 * Convert an Error instance to a plain object, including all its non-iterable properties.
 * @param err Error to convert to Object
 * @returns Object representation of the error
 */
export const errToObj = (err: Error): any =>
  Object.getOwnPropertyNames(err).reduce((acc, name) => {
    acc[name] = err[name];
    return acc;
  }, {});
