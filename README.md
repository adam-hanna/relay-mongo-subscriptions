# Relay Mongo Subscriptions

This library can be used to implement relay subscriptions with MongoDB.

## Demo

A simple TODO demo can be found, [here](https://github.com/adam-hanna/relay-mongo-subscriptions-example).

![Demo GIF](https://github.com/adam-hanna/relay-mongo-subscriptions-example/blob/master/20210813_example_v2.gif)

## Quickstart

**schema.graphql**

```graphql
scalar Object

type TodoForSubscription {
  _id: ID!
  description: String!
  completed: Boolean!
}

type TruncatedArrays {
  field: String!
  newSize: Int!
}

type UpdateDescription {
  updatedFields: Object!
  removedFields: [String!]!
  truncatedArrays: [TruncatedArrays!]!
}

type TodoSubscription {
  doc: TodoForSubscription!
  operationType: String!
  updateDescription: UpdateDescription
}

type Subscription {
  todosChanged: [TodoSubscription!]!
}
```

**server.ts**

```typescript
import {
  Collection,
  Db,
  MongoClient,
} from 'mongodb'
import Watcher from 'relay-mongo-subscriptions/lib/watcher'

const client = new MongoClient('mongodb://localhost:27017', {})
await client.connect()

const db = client.db('todos');
const todosCollection = db.collection('todos')

const watcher = Watcher.getInstance()
watcher.setCollections({
  collections: [todosCollection]
})
await watcher.openChangeStreams()
```

**subscriptions.ts**

```typescript
import PubSub from 'relay-mongo-subscriptions/lib/pubsub'

export const subscriptions = {
    todosChanged: {
        subscribe: (parent, args, context, info): AsyncIterator<any> => {
            return PubSub({
              collectionName: 'todos',
              query: {}, // note: if you wanted to query the todo's, you could pick it up from args.query, etc
              delay: 500,
              leading: false,
              trailing: true,
            })
        },
        // @ts-ignore
        resolve: payload => {
            return payload
        }
    }
}
```

## Methodology

This library opens a [change stream](https://docs.mongodb.com/manual/changeStreams/) on the passed collections. As documents come in through the stream, they are checked against the queries given in the `PubSub`. The matching algorithm used is the one from [Meteor.js minimongo](https://github.com/meteor/meteor/blob/devel/packages/minimongo/matcher.js). Documents that match are pushed into a buffer and, via a throttle, pushed in an array down the wire to the client.

## Notes

### Delete

The biggest caveat is that you cannot delete documents from the collection. When a document is deleted, it is not included in the change stream and therefore cannot be matched against a query.

Rather, I suggest using some sort of boolean to flip between active/disabled.

### Enabling Change Streams

Change streams are only available for [replica sets or sharded clusters](https://docs.mongodb.com/manual/changeStreams/#availability). To convert a standalone instance to a replica set, follow [this guide](https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set/).

If you are using AWS DocumentDB, you will need to first [enable change streams](https://docs.aws.amazon.com/documentdb/latest/developerguide/change_streams.html), and secondly, when creating the collections, you will need to set the read preference to primary. e.g.

```typescript
import { 
    ...,
    ReadPreference,
} from 'mongodb'

const todosCollection = db.collection('todos', { readPreference: ReadPreference.PRIMARY })
```

## LICENSE

[MIT](LICENSE)

```
The MIT License (MIT)

Copyright (c) 2021 Adam Hanna

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
