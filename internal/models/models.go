package models

import (
	"time"

	"gorm.io/gorm"
)

type Visibility string

const (
	VisibilityPublic   Visibility = "public"
	VisibilityUnlisted Visibility = "unlisted"
	VisibilityPrivate  Visibility = "private"
)

type User struct {
	ID           string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Email        string `gorm:"uniqueIndex;not null"`
	Username     string `gorm:"uniqueIndex;not null"`
	PasswordHash string `gorm:"not null"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Snippet struct {
	ID          string     `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Slug        string     `gorm:"uniqueIndex;type:text" json:"slug"`
	OwnerID     *string    `gorm:"type:uuid;index" json:"ownerId,omitempty"`
	Title       string     `json:"title"`
	Content     string     `gorm:"type:text" json:"content"`
	IsEncrypted bool       `gorm:"default:false" json:"isEncrypted"`
	Language    string     `gorm:"index" json:"language"`
	Visibility  Visibility `gorm:"default:'public';index" json:"visibility"`
	ExpiresAt   *time.Time `json:"expiresAt,omitempty"`
	BurnAfterRead bool     `gorm:"default:false" json:"burnAfterRead"`
	PasswordHash *string   `gorm:"type:text" json:"-"`
	ForkOfID    *string    `gorm:"type:uuid;index" json:"forkOfId,omitempty"`
	ForkCount   int        `gorm:"default:0" json:"forkCount"`
	Tags        []Tag      `gorm:"many2many:snippet_tags;" json:"tags,omitempty"`
	Collections []Collection `gorm:"many2many:collection_snippets;" json:"-"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type SnippetVersion struct {
	ID        string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	SnippetID string `gorm:"type:uuid;index;not null"`
	Title     string
	Content   string `gorm:"type:text"`
	Language  string
	CreatedAt time.Time
}

type Tag struct {
	ID   string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name string `gorm:"uniqueIndex;not null" json:"name"`
}

type Collection struct {
	ID        string `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	OwnerID   string `gorm:"type:uuid;index;not null" json:"ownerId"`
	Name      string `json:"name"`
	Snippets  []Snippet `gorm:"many2many:collection_snippets;" json:"snippets,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Comment struct {
	ID         string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	SnippetID  string    `gorm:"type:uuid;index;not null" json:"snippetId"`
	AuthorName string    `gorm:"type:text;default:'anon'" json:"authorName"`
	Body       string    `gorm:"type:text;not null" json:"body"`
	CreatedAt  time.Time `json:"createdAt"`
}


