package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"

	"flapstack/internal/crypto"
	"flapstack/internal/models"
)

var slugSanitize = regexp.MustCompile(`[^a-z0-9-]+`)
var slugCollapse = regexp.MustCompile(`-+`)
var uuidRE = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// makeSlug turns a title into a URL-safe slug. Falls back to a random hex tag
// when the title is empty or sanitises to nothing.
func makeSlug(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	s = slugSanitize.ReplaceAllString(s, "-")
	s = slugCollapse.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > 60 {
		s = s[:60]
	}
	suffix := randHex(4)
	if s == "" {
		return suffix
	}
	return s + "-" + suffix
}

func randHex(nBytes int) string {
	b := make([]byte, nBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// findSnippet looks up by UUID first, then by slug.
func (h *Handler) findSnippet(idOrSlug string) (*models.Snippet, error) {
	var s models.Snippet
	q := h.DB
	if uuidRE.MatchString(strings.ToLower(idOrSlug)) {
		err := q.First(&s, "id = ?", idOrSlug).Error
		if err == nil {
			return &s, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	if err := q.First(&s, "slug = ?", idOrSlug).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

// --- Fork ----------------------------------------------------------------

func (h *Handler) ForkSnippet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	src, handled := h.loadSnippet(w, id)
	if handled {
		return
	}
	// Refuse to fork password-protected or burn snippets — they're meant to be private.
	if src.PasswordHash != nil || src.BurnAfterRead {
		writeErr(w, http.StatusForbidden, "not_forkable", "this snippet cannot be forked")
		return
	}
	// Decrypt source content if needed so the fork is plain (forks aren't vaults).
	plain, err := crypto.Decrypt(src.Content)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "decrypt_error", err.Error())
		return
	}
	srcID := src.ID
	fork := models.Snippet{
		Slug:       makeSlug(src.Title + " fork"),
		Title:      src.Title,
		Content:    plain,
		Language:   src.Language,
		Visibility: models.VisibilityPublic,
		ForkOfID:   &srcID,
	}
	if err := h.DB.Create(&fork).Error; err != nil {
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	h.DB.Model(&models.Snippet{}).Where("id = ?", src.ID).
		UpdateColumn("fork_count", gorm.Expr("fork_count + 1"))
	writeJSON(w, http.StatusCreated, toView(&fork, true))
}

// --- Comments ------------------------------------------------------------

type createCommentReq struct {
	AuthorName string `json:"authorName"`
	Body       string `json:"body"`
}

func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var rows []models.Comment
	if err := h.DB.
		Where("snippet_id = ?", id).
		Order("created_at ASC").
		Find(&rows).Error; err != nil {
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req createCommentReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid_json", "invalid json")
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" {
		writeErr(w, http.StatusBadRequest, "missing_body", "comment body is required")
		return
	}
	if len(body) > 5000 {
		writeErr(w, http.StatusBadRequest, "too_long", "comment too long")
		return
	}
	// Ensure the parent snippet exists.
	var s models.Snippet
	if err := h.DB.First(&s, "id = ?", id).Error; err != nil {
		writeErr(w, http.StatusNotFound, "not_found", "snippet not found")
		return
	}
	author := strings.TrimSpace(req.AuthorName)
	if author == "" {
		author = "anon"
	}
	if len(author) > 40 {
		author = author[:40]
	}
	c := models.Comment{SnippetID: id, AuthorName: author, Body: body}
	if err := h.DB.Create(&c).Error; err != nil {
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, c)
}
