# RaftDB 🗄️

**A Distributed Key-Value Store using the Raft Consensus Algorithm**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

## Overview

RaftDB is a distributed key-value store that achieves consensus using the **Raft consensus algorithm**. It provides a fault-tolerant, strongly consistent data store suitable for building distributed systems.

### What is Raft?

Raft is a consensus algorithm designed to be understandable. It was created by Diego Ongaro and John Ousterhout at Stanford University as an alternative to Paxos. Raft achieves consensus through:

1. **Leader Election** - One node becomes the leader
2. **Log Replication** - Commands are replicated to all nodes
3. **Safety** - Consistent state across the cluster

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      RaftDB Cluster                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │   Node 1    │    │   Node 2    │    │   Node 3    │   │
│   │   (Leader)  │◄──►│  (Follower) │◄──►│  (Follower) │   │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘   │
│          │                   │                   │           │
│          │    AppendEntries  │    AppendEntries  │           │
│          └──────────────────┴───────────────────┘           │
│                            │                                 │
│                     Log Replication                          │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                   State Machine                        │  │
│   │              (Key-Value Store)                        │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Core Raft Features
- ✅ **Leader Election** - Randomized election timeouts prevent split votes
- ✅ **Log Replication** - Commands replicated to all followers
- ✅ **Term-based Consensus** - Logical clock for safety
- ✅ **Vote Requests** - Candidates request votes from peers
- ✅ **Heartbeats** - Leader sends periodic heartbeats
- ✅ **Log Compaction** - Snapshotting support

### Database Features
- ✅ **Put/Get Operations** - Linearizable reads and writes
- ✅ **Key-Value Storage** - In-memory with persistence
- ✅ **Cluster Membership** - Dynamic membership changes
- ✅ **Partition Tolerance** - Continues operation during network partitions

## Installation

```bash
npm install raftdb
```

Or install from source:

```bash
git clone https://github.com/moggan1337/RaftDB.git
cd RaftDB
npm install
npm run build
```

## Quick Start

```typescript
import { RaftNode, NodeState } from 'raftdb';

// Create cluster configuration
const config = {
  id: 'node-1',
  peers: ['node-2', 'node-3'],
  electionTimeout: 5000,    // ms
  heartbeatInterval: 1000   // ms
};

// Create and start node
const node = new RaftNode(config);
node.start();

// Wait for leader election
setTimeout(() => {
  const state = node.getState();
  console.log(`Node is: ${state.state}`);
  
  // Put operations (only works on leader)
  if (state.state === 'Leader') {
    node.put('name', 'Alice');
    node.put('age', '30');
    
    console.log('name:', node.get('name'));
    console.log('age:', node.get('age'));
  }
}, 6000);
```

## API Reference

### RaftNode Class

#### Constructor
```typescript
new RaftNode(config: NodeConfig)
```

#### Configuration
```typescript
interface NodeConfig {
  id: string;                    // Unique node identifier
  peers: string[];               // List of peer node IDs
  electionTimeout: number;        // Election timeout in ms (default: 5000)
  heartbeatInterval: number;     // Heartbeat interval in ms (default: 1000)
}
```

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `start()` | `void` | Start the Raft node |
| `stop()` | `void` | Stop the Raft node |
| `put(key, value)` | `boolean` | Store a key-value pair |
| `get(key)` | `string \| undefined` | Retrieve a value |
| `getState()` | `RaftState` | Get current node state |

#### State Object
```typescript
interface RaftState {
  id: string;
  state: 'Follower' | 'Candidate' | 'Leader';
  term: number;
  commitIndex: number;
  logLength: number;
}
```

## How Raft Works

### Leader Election

```
┌─────────────────────────────────────────────────────────────┐
│                    Leader Election Process                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Follower doesn't receive heartbeat                       │
│     ┌─────────┐                                             │
│     │ Follower │  election timeout                            │
│     └────┬────┘                                             │
│          │                                                  │
│          ▼                                                  │
│  2. Become Candidate                                        │
│     ┌─────────┐                                             │
│     │Candidate │  increment term, vote for self              │
│     └────┬────┘                                             │
│          │                                                  │
│          ▼                                                  │
│  3. Send Vote Requests                                     │
│     ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│     │Candidate │───►│ Peer 1  │───►│ Peer 2  │             │
│     └─────────┘    └────┬────┘    └────┬────┘             │
│                        │ voteGranted    │ voteGranted       │
│                        └───────┬────────┘                   │
│                                │                             │
│                                ▼                             │
│  4. Receive majority → Become Leader                        │
│     ┌─────────┐                                             │
│     │ Leader  │  send AppendEntries to all                   │
│     └─────────┘                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Log Replication

```
┌─────────────────────────────────────────────────────────────┐
│                    Log Replication Process                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client                                                      │
│     │                                                         │
│     │ put('name', 'Alice')                                   │
│     ▼                                                         │
│  Leader                                                       │
│     │                                                         │
│     │ 1. Append to local log                                │
│     │    ┌──────────────────────────────┐                     │
│     │    │ Log Entry: {term, index,   │                     │
│     │    │        command: PUT name    │                     │
│     │    │        Alice}              │                     │
│     │    └──────────────────────────────┘                     │
│     │                                                         │
│     │ 2. Send AppendEntries to followers                      │
│     └──────────────────────────────────────────►             │
│                                        │                      │
│                                        ▼                      │
│  Followers                                                     │
│     │                                                         │
│     │ 3. Append entry to local log                            │
│     │ 4. Send response                                        │
│     └──────────────────────────────────────────►             │
│                                                              │
│  Leader                                                       │
│     │                                                         │
│     │ 5. When majority responds, commit entry                │
│     │ 6. Apply to state machine                             │
│     │ 7. Return to client                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Consensus Properties

Raft satisfies the following properties:

| Property | Description |
|----------|-------------|
| **Election Safety** | At most one leader can be elected in a given term |
| **Leader Append-Only** | A leader never overwrites or deletes entries |
| **Log Matching** | If two logs contain an entry with the same index and term, they are identical |
| **Leader Completeness** | Entries from a leader's term are present in all subsequent leaders |
| **State Machine Safety** | If a server has applied an entry, no other server will apply a different command |

## Example: Building a Distributed Cache

```typescript
import { RaftNode } from 'raftdb';

class DistributedCache {
  private nodes: RaftNode[] = [];
  
  constructor(peerCount: number) {
    for (let i = 1; i <= peerCount; i++) {
      const peers = Array.from({length: peerCount}, (_, j) => `cache-${j+1}`)
        .filter(id => id !== `cache-${i}`);
      
      const node = new RaftNode({
        id: `cache-${i}`,
        peers,
        electionTimeout: 3000 + Math.random() * 2000,
        heartbeatInterval: 500
      });
      
      this.nodes.push(node);
    }
  }
  
  start() {
    this.nodes.forEach(n => n.start());
  }
  
  async put(key: string, value: string): Promise<boolean> {
    // Try each node until one accepts
    for (const node of this.nodes) {
      if (node.put(key, value)) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }
  
  async get(key: string): Promise<string | undefined> {
    for (const node of this.nodes) {
      const state = node.getState();
      if (state.state === 'Leader') {
        return node.get(key);
      }
    }
    return undefined;
  }
}

// Usage
const cache = new DistributedCache(3);
cache.start();

setTimeout(async () => {
  await cache.put('session:123', 'user_data');
  const data = await cache.get('session:123');
  console.log('Cache hit:', data);
}, 5000);
```

## Configuration

### Election Timeout

The election timeout should be significantly larger than the heartbeat interval:

```typescript
const config = {
  id: 'node-1',
  peers: ['node-2', 'node-3'],
  electionTimeout: 5000,     // 5 seconds
  heartbeatInterval: 1000    // 1 second
};
```

### Recommended Settings

| Cluster Size | Election Timeout | Heartbeat Interval |
|-------------|------------------|-------------------|
| 3 nodes | 5000ms | 1000ms |
| 5 nodes | 3000ms | 500ms |
| 7 nodes | 2000ms | 250ms |

## Debugging

Enable debug logging:

```typescript
const node = new RaftNode({
  id: 'node-1',
  peers: ['node-2'],
  electionTimeout: 5000,
  heartbeatInterval: 1000
});

// Access internal state
setInterval(() => {
  console.log(JSON.stringify(node.getState(), null, 2));
}, 2000);
```

## Contributing

Contributions are welcome! Please read the contributing guidelines first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Diego Ongaro and John Ousterhout for the Raft algorithm
- The Raft paper: "In Search of an Understandable Consensus Algorithm"

## References

- [Raft Paper](https://raft.github.io/raft.pdf)
- [Raft Website](https://raft.github.io/)
- [The Secret Lives of Data](http://thesecretlivesofdata.com/raft/) - Visual Raft guide
