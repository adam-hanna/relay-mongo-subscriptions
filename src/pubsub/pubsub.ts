import { $$asyncIterator } from 'iterall';

import Watcher from '../watcher'
import Throttle from '../throttle'

const pubsub = ({
  collectionName,
  query,
  delay,
  leading,
  trailing,
}: {
  collectionName: string;
  // note: any better type here?
  query: any;
  delay: number;
  leading: boolean;
  trailing: boolean;
}): AsyncIterator<any> => {
  const throttler = new Throttle({
    delay,
    leading,
    trailing,
  })
  const watcher = Watcher.getInstance()
  watcher.subscribe({ collectionName, query, throttle: throttler })

  return {
    async next(): Promise<IteratorResult<any>> {
      // eslint-disable-next-line
      return new Promise(async (resolve, reject) => {
        const [b, err] = throttler.buff()
        if (err) {
          watcher.unSubscribe({ collectionName, query, throttle: throttler })
          reject(b)
          return
        }

        if (b?.length) {
          resolve({
            value: b,
            done: false,
          })
        } 
        else {
          await throttler.once()

          const [b1, err1] = throttler.buff()
          if (err1) {
            watcher.unSubscribe({ collectionName, query, throttle: throttler })
            reject(b1)
            return
          }

          resolve({
            value: b1,
            done: false,
          })
        }
      })
    },
    async return(): Promise<IteratorResult<any>> {
      watcher.unSubscribe({ collectionName, query, throttle: throttler })

      return { value: undefined, done: true };
    },
    throw(error: Error): Promise<IteratorResult<any>> {
      throttler.error(error);

      watcher.unSubscribe({ collectionName, query, throttle: throttler })

      return Promise.reject({ value: error, done: true });
    },
    // @ts-ignore
    [$$asyncIterator]() {
      return this;
    },
  };
}

export default pubsub;
