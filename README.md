# RaftDB 🗄️

**Distributed Database using Raft Consensus Algorithm**

## What is Raft?

Raft is a consensus algorithm designed to be understandable. It achieves consensus through:
- **Leader Election** - One node becomes leader
- **Log Replication** - Commands are replicated to all nodes
- **Safety** - Consistent state across cluster

## Architecture

```
┌─────────────────────────────────────────────┐
│              RaftDB Cluster                   │
├─────────────┬─────────────┬─────────────────┤
│   Node 1    │   Node 2    │     Node 3      │
│   (Leader)  │  (Follower) │   (Follower)    │
├─────────────┼─────────────┼─────────────────┤
│  - Log      │  - Log      │   - Log          │
│  - State    │  - State    │   - State        │
│  - Timer     │  - Timer    │   - Timer        │
└─────────────┴─────────────┴─────────────────┘
```

## Features

- ✅ Leader Election
- ✅ Log Replication
- ✅ Membership Changes
- ✅ Linearizable Reads
- ✅ Heartbeats
- ✅ Term-based voting

## Installation

```bash
npm install raftdb
```

## Usage

```typescript
import { RaftNode } from 'raftdb';

const node = new RaftNode({
  id: 'node-1',
  peers: ['node-2', 'node-3'],
  electionTimeout: 5000,
  heartbeatInterval: 1000
});

node.start();

// Client operations
node.put('key', 'value');
const value = node.get('key');
```

## Consensus Properties

| Property | Description |
|----------|-------------|
| Election Safety | At most one leader per term |
| Leader Append-Only | Leader never overwrites entries |
| Log Matching | If entries match, logs are identical |
| Leader Completeness | Committed entries persist in new leaders |

## License

MIT
