import { 
  ChangeStream,
  Collection,
} from 'mongodb'; 
import { remove } from 'lodash'
import {
  MD5
} from 'object-hash'

// @ts-ignore
import Matcher from '../lib/minimongo'
import Throttle from '../throttle'

export type ChangeStreamsMap = {
  [collectionName: string]: ChangeStream;
}

export type SubscriptionsMap = { 
  [collectionName: string]: { 
    [queryHash: string]: {
      matcher: typeof Matcher;
      throttles: Array<Throttle>;
    }
  } 
}

export default class Watcher {
  public setCollections(
    { collections }: 
    { collections: Array<Collection> }
  ): void {
    this.collections_ = collections
  }

  public subscribe({ collectionName, query, throttle }: { collectionName: string; query: any; throttle: Throttle }): void {
    const queryStr = MD5(query)

    if (!this.subscriptions_[collectionName]) {
      this.subscriptions_[collectionName] = {}
    }

    if (!this.subscriptions_[collectionName][queryStr]) {
      const matcher = new Matcher(query)
      this.subscriptions_[collectionName][queryStr] = {
        matcher,
        throttles: []
      }
    }

    this.subscriptions_[collectionName][queryStr].throttles.push(throttle)

    return
  }

  public unSubscribe({ collectionName, query, throttle }: { collectionName: string; query: any; throttle: Throttle }): void {
    if (!this.subscriptions_[collectionName]) {
      return
    }

    const queryStr = MD5(query)
    if (!this.subscriptions_[collectionName][queryStr]) {
      return
    }

    remove(
      this.subscriptions_[collectionName][queryStr].throttles, t => {
        return t === throttle
      }
    )

    if (this.subscriptions_[collectionName][queryStr].throttles.length === 0) {
      delete this.subscriptions_[collectionName][queryStr]
    }

    return
  }

  public async openChangeStreams(): Promise<void> {
    this.collections_?.forEach(collection => {
      if (this.changeStreams_[collection.collectionName]) {
        this.changeStreams_[collection.collectionName].close()
      }
      
      this.openChangeStream(collection)
    })
  }

  // note: helpful when testing
  public getSubscriptions(): SubscriptionsMap {
    return Object.assign({}, this.subscriptions_)
  }

  public static getInstance(): Watcher {
    if (!Watcher.instance_) {
      Watcher.instance_ = new Watcher();
    }

    return Watcher.instance_;
  }

  public close(): void {
    Object.keys(this.changeStreams_).forEach(collectionName => {
      this.changeStreams_[collectionName].close()
    })
  }

  private collections_: Array<Collection> | undefined;
  private changeStreams_: ChangeStreamsMap = {};
  private subscriptions_: SubscriptionsMap = {};

  private static instance_: Watcher;
  private constructor() {}

  private openChangeStream(collection: Collection): void {
      const cs = collection.watch(
        [
          {
            // note: match anything
            $match: {},
          },
        ],
        {
          fullDocument : "updateLookup"
        }
      )
      cs.on('change', data => {
        if (data?.operationType?.toLowerCase() === 'delete') {
          return
        }

        if (!data || !data.fullDocument) {
          return
        }

        Object.keys(this.subscriptions_).forEach(collectionName => {
          if (collectionName !== collection.collectionName) {
            return
          }

          Object.keys(this.subscriptions_[collectionName]).forEach(queryStr => {
            const { matcher } = this.subscriptions_[collectionName][queryStr]
            const { result } = matcher.documentMatches(data.fullDocument)

            if (result) {
              this.subscriptions_[collectionName][queryStr]?.throttles?.forEach(t => {
                t.push({
                  doc: data.fullDocument,
                  operationType: data.operationType,
                  updateDescription: data.updateDescription
                })
              })
            }
          })
        })
      })
      cs.on('error', _err => {
        // note: should throw?
        cs.close()
        void this.openChangeStream(collection)
      })
      cs.on('close', () => {
        // note: do nothing?
        //void this.openChangeStream()
      })
      cs.on('end', () => {
        // note: do nothing?
        //void this.openChangeStream()
      })

      this.changeStreams_[collection.collectionName] = cs
  }
}
