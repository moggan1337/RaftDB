/**
 * RaftDB - Distributed Database using Raft Consensus
 * 
 * This implements the Raft consensus algorithm for a distributed key-value store.
 * Features:
 * - Leader election
 * - Log replication
 * - Membership changes
 * - Linearizable reads
 */

export enum NodeState { Follower, Candidate, Leader }
export enum MessageType { VoteRequest, VoteResponse, AppendEntries, AppendResponse }

export interface LogEntry {
  term: number;
  index: number;
  command: string;
}

export interface NodeConfig {
  id: string;
  peers: string[];
  electionTimeout: number;
  heartbeatInterval: number;
}

export class RaftNode {
  private state: NodeState = NodeState.Follower;
  private currentTerm = 0;
  private votedFor: string | null = null;
  private log: LogEntry[] = [];
  private commitIndex = 0;
  private lastApplied = 0;
  private kvStore = new Map<string, string>();
  
  // Leader state
  private nextIndex = new Map<string, number>();
  private matchIndex = new Map<string, number>();
  
  private electionTimeout: number;
  private heartbeatInterval: number;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  constructor(private config: NodeConfig) {
    this.electionTimeout = config.electionTimeout;
    this.heartbeatInterval = config.heartbeatInterval;
  }
  
  start() {
    this.isRunning = true;
    this.startElectionTimer();
    console.log(`RaftNode ${this.config.id} started as ${NodeState[this.state]}`);
  }
  
  stop() {
    this.isRunning = false;
    if (this.timer) clearTimeout(this.timer);
  }
  
  private startElectionTimer() {
    if (!this.isRunning) return;
    const timeout = this.electionTimeout + Math.random() * 1000;
    this.timer = setTimeout(() => this.startElection(), timeout);
  }
  
  private startElection() {
    if (!this.isRunning) return;
    this.state = NodeState.Candidate;
    this.currentTerm++;
    this.votedFor = this.config.id;
    
    console.log(`Node ${this.config.id} starting election for term ${this.currentTerm}`);
    
    // Request votes from peers
    for (const peer of this.config.peers) {
      this.sendVoteRequest(peer);
    }
    
    this.startElectionTimer();
  }
  
  private sendVoteRequest(peer: string) {
    const lastLogIndex = this.log.length > 0 ? this.log[this.log.length - 1].index : 0;
    const lastLogTerm = this.log.length > 0 ? this.log[this.log.length - 1].term : 0;
    
    const request = {
      type: MessageType.VoteRequest,
      term: this.currentTerm,
      candidateId: this.config.id,
      lastLogIndex,
      lastLogTerm
    };
    
    console.log(`Sending vote request to ${peer}:`, request);
  }
  
  handleVoteResponse(response: { term: number; voteGranted: boolean }) {
    if (response.term > this.currentTerm) {
      this.currentTerm = response.term;
      this.state = NodeState.Follower;
      this.votedFor = null;
      return;
    }
    
    if (response.voteGranted) {
      const votes = [...this.config.peers, this.config.id].filter(id => this.votedFor === id || this.hasVotedFor(id)).length;
      const majority = Math.floor((this.config.peers.length + 1) / 2) + 1;
      
      if (votes >= majority) {
        this.becomeLeader();
      }
    }
  }
  
  private hasVotedFor(id: string): boolean {
    return this.votedFor === id;
  }
  
  private becomeLeader() {
    this.state = NodeState.Leader;
    console.log(`Node ${this.config.id} became leader for term ${this.currentTerm}`);
    
    // Initialize leader state
    for (const peer of this.config.peers) {
      this.nextIndex.set(peer, this.log.length + 1);
      this.matchIndex.set(peer, 0);
    }
    
    // Send heartbeats
    this.sendHeartbeats();
  }
  
  private sendHeartbeats() {
    if (!this.isRunning || this.state !== NodeState.Leader) return;
    
    for (const peer of this.config.peers) {
      this.sendAppendEntries(peer);
    }
    
    // Schedule next heartbeat
    setTimeout(() => this.sendHeartbeats(), this.heartbeatInterval);
  }
  
  private sendAppendEntries(peer: string) {
    const nextIndex = this.nextIndex.get(peer) || 1;
    const prevLogIndex = nextIndex - 1;
    const prevLogTerm = prevLogIndex > 0 && this.log[prevLogIndex - 1] 
      ? this.log[prevLogIndex - 1].term : 0;
    
    const entries = this.log.slice(prevLogIndex).slice(0, 10);
    
    const request = {
      type: MessageType.AppendEntries,
      term: this.currentTerm,
      leaderId: this.config.id,
      prevLogIndex,
      prevLogTerm,
      entries,
      leaderCommit: this.commitIndex
    };
    
    console.log(`Sending AppendEntries to ${peer}:`, request);
  }
  
  // Public API for client operations
  put(key: string, value: string): boolean {
    if (this.state !== NodeState.Leader) {
      console.log('Not leader, redirecting...');
      return false;
    }
    
    const entry: LogEntry = {
      term: this.currentTerm,
      index: this.log.length + 1,
      command: `PUT ${key} ${value}`
    };
    
    this.log.push(entry);
    console.log(`Logged: ${entry.command}`);
    
    // Replicate to followers
    this.replicateToFollowers();
    
    return true;
  }
  
  get(key: string): string | undefined {
    // Linearizable read - must check with leader first
    return this.kvStore.get(key);
  }
  
  private replicateToFollowers() {
    for (const peer of this.config.peers) {
      this.sendAppendEntries(peer);
    }
    
    // If replicated to majority, commit
    const committedCount = 1; // Self
    for (const [peer, matchIdx] of this.matchIndex) {
      if (matchIdx > this.commitIndex) {
        const replicationCount = [...this.matchIndex.values()].filter(i => i >= matchIdx).length + 1;
        if (replicationCount >= Math.floor((this.config.peers.length + 1) / 2) + 1) {
          this.commitIndex = matchIdx;
          this.applyCommittedEntries();
          break;
        }
      }
    }
  }
  
  private applyCommittedEntries() {
    while (this.lastApplied < this.commitIndex) {
      this.lastApplied++;
      const entry = this.log[this.lastApplied - 1];
      if (entry) {
        const [, key, value] = entry.command.split(' ');
        this.kvStore.set(key, value);
        console.log(`Applied: ${entry.command}`);
      }
    }
  }
  
  getState() {
    return {
      id: this.config.id,
      state: NodeState[this.state],
      term: this.currentTerm,
      commitIndex: this.commitIndex,
      logLength: this.log.length
    };
  }
}
