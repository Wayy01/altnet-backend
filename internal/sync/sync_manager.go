package sync

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

// SyncManager manages active sync operations and their cancellation contexts
// This enables graceful cancellation of running syncs from external requests
type SyncManager struct {
	mu            sync.RWMutex
	activeSyncs   map[uuid.UUID]*ActiveSync
	cleanupTicker *time.Ticker
	done          chan struct{}
}

// ActiveSync represents an active sync operation
type ActiveSync struct {
	SyncLogID   uuid.UUID
	CancelFunc  context.CancelFunc
	StartedAt   time.Time
	SyncType    string
	Reason      string // Cancellation reason (if cancelled)
	IsCancelled bool
}

// NewSyncManager creates a new sync manager instance
func NewSyncManager() *SyncManager {
	sm := &SyncManager{
		activeSyncs:   make(map[uuid.UUID]*ActiveSync),
		cleanupTicker: time.NewTicker(5 * time.Minute),
		done:          make(chan struct{}),
	}

	// Start cleanup goroutine to remove stale entries
	go sm.cleanupLoop()

	return sm
}

// RegisterSync registers a new active sync operation
// Returns a context that will be cancelled when CancelSync is called
func (sm *SyncManager) RegisterSync(syncLogID uuid.UUID, syncType string) (context.Context, context.CancelFunc) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Create cancellable context
	ctx, cancel := context.WithCancel(context.Background())

	// Store active sync info
	sm.activeSyncs[syncLogID] = &ActiveSync{
		SyncLogID:   syncLogID,
		CancelFunc:  cancel,
		StartedAt:   time.Now(),
		SyncType:    syncType,
		IsCancelled: false,
	}

	log.Printf("SyncManager: Registered sync %s (type: %s)", syncLogID, syncType)

	// Return wrapped cancel func that also cleans up from map
	wrappedCancel := func() {
		cancel()
		sm.UnregisterSync(syncLogID)
	}

	return ctx, wrappedCancel
}

// CancelSync cancels an active sync operation
func (sm *SyncManager) CancelSync(syncLogID uuid.UUID, reason string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	activeSync, exists := sm.activeSyncs[syncLogID]
	if !exists {
		return fmt.Errorf("sync not found")
	}

	// Mark as cancelled and call cancel function
	activeSync.IsCancelled = true
	activeSync.Reason = reason
	activeSync.CancelFunc()

	log.Printf("SyncManager: Cancelled sync %s. Reason: %s", syncLogID, reason)

	return nil
}

// UnregisterSync removes a sync from the active syncs map
// This should be called when a sync completes (either successfully, failed, or cancelled)
func (sm *SyncManager) UnregisterSync(syncLogID uuid.UUID) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if _, exists := sm.activeSyncs[syncLogID]; exists {
		delete(sm.activeSyncs, syncLogID)
		log.Printf("SyncManager: Unregistered sync %s", syncLogID)
	}
}

// GetActiveSync retrieves information about an active sync
func (sm *SyncManager) GetActiveSync(syncLogID uuid.UUID) (*ActiveSync, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	activeSync, exists := sm.activeSyncs[syncLogID]
	return activeSync, exists
}

// GetActiveSyncs returns a list of all active syncs
func (sm *SyncManager) GetActiveSyncs() []*ActiveSync {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	syncs := make([]*ActiveSync, 0, len(sm.activeSyncs))
	for _, sync := range sm.activeSyncs {
		syncs = append(syncs, sync)
	}

	return syncs
}

// IsRunning checks if a sync is currently running
func (sm *SyncManager) IsRunning(syncLogID uuid.UUID) bool {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	_, exists := sm.activeSyncs[syncLogID]
	return exists
}

// cleanupLoop periodically removes stale sync entries
// This handles cases where syncs crash without proper cleanup
func (sm *SyncManager) cleanupLoop() {
	for {
		select {
		case <-sm.cleanupTicker.C:
			sm.cleanupStaleEntries()
		case <-sm.done:
			return
		}
	}
}

// cleanupStaleEntries removes sync entries older than 24 hours
// These are likely orphaned entries from crashed syncs
func (sm *SyncManager) cleanupStaleEntries() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	staleThreshold := time.Now().Add(-24 * time.Hour)
	staleCount := 0

	for syncLogID, activeSync := range sm.activeSyncs {
		if activeSync.StartedAt.Before(staleThreshold) {
			delete(sm.activeSyncs, syncLogID)
			staleCount++
			log.Printf("SyncManager: Cleaned up stale sync entry %s (started: %s)", syncLogID, activeSync.StartedAt)
		}
	}

	if staleCount > 0 {
		log.Printf("SyncManager: Cleaned up %d stale sync entries", staleCount)
	}
}

// Shutdown gracefully shuts down the sync manager
func (sm *SyncManager) Shutdown() {
	close(sm.done)
	sm.cleanupTicker.Stop()

	// Cancel all active syncs
	sm.mu.Lock()
	defer sm.mu.Unlock()

	for syncLogID, activeSync := range sm.activeSyncs {
		activeSync.CancelFunc()
		log.Printf("SyncManager: Cancelled sync %s due to shutdown", syncLogID)
	}

	sm.activeSyncs = make(map[uuid.UUID]*ActiveSync)
}

// Stats returns statistics about active syncs
type SyncManagerStats struct {
	ActiveSyncs    int       `json:"active_syncs"`
	OldestSyncTime time.Time `json:"oldest_sync_time,omitempty"`
}

// GetStats returns statistics about the sync manager
func (sm *SyncManager) GetStats() SyncManagerStats {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	stats := SyncManagerStats{
		ActiveSyncs: len(sm.activeSyncs),
	}

	// Find oldest sync
	var oldestTime time.Time
	for _, activeSync := range sm.activeSyncs {
		if oldestTime.IsZero() || activeSync.StartedAt.Before(oldestTime) {
			oldestTime = activeSync.StartedAt
		}
	}

	if !oldestTime.IsZero() {
		stats.OldestSyncTime = oldestTime
	}

	return stats
}
