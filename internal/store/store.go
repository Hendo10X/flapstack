package store

import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"flapstack/internal/models"
)

func Open(dsn string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(dsn), &gorm.Config{})
}

func AutoMigrate(db *gorm.DB) error {
	if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).Error; err != nil {
		return err
	}
	// One-off cleanup: the old comments schema used a NOT NULL author_id.
	// Drop it if present so the new author_name column path works.
	if err := db.Exec(`ALTER TABLE IF EXISTS comments DROP COLUMN IF EXISTS author_id`).Error; err != nil {
		return err
	}
	return db.AutoMigrate(
		&models.User{},
		&models.Snippet{},
		&models.SnippetVersion{},
		&models.Tag{},
		&models.Collection{},
		&models.Comment{},
	)
}
