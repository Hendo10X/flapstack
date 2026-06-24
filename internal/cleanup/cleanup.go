package cleanup

import (
	"log"
	"time"

	"gorm.io/gorm"

	"flapstack/internal/models"
)

// Start begins a background goroutine that periodically cleans up expired
// and burn-after-read snippets. It runs every 15 minutes by default.
func Start(db *gorm.DB, interval time.Duration) {
	if interval == 0 {
		interval = 15 * time.Minute
	}

	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for range ticker.C {
			if err := cleanup(db); err != nil {
				log.Printf("cleanup error: %v", err)
			}
		}
	}()

	log.Printf("cleanup service started (interval: %v)", interval)
}

// cleanup deletes:
// 1. Snippets that have expired (ExpiresAt < now)
// 2. Snippets marked with BurnAfterRead that have been created before a grace period
//    (since burn-after-read snippets should be deleted on access, this is a fallback)
func cleanup(db *gorm.DB) error {
	now := time.Now().UTC()

	// Delete expired snippets
	if err := db.
		Where("expires_at IS NOT NULL AND expires_at < ?", now).
		Delete(&models.Snippet{}).Error; err != nil {
		return err
	}

	// Delete burn-after-read snippets older than 24 hours (fallback cleanup)
	// In normal operation, they should be deleted on access via GetSnippet/VerifySnippet
	// But this catches cases where the snippet was created and never accessed.
	gracePeriod := now.Add(-24 * time.Hour)
	if err := db.
		Where("burn_after_read = ? AND created_at < ?", true, gracePeriod).
		Delete(&models.Snippet{}).Error; err != nil {
		return err
	}

	return nil
}
