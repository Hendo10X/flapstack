package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"flapstack/internal/crypto"
	"flapstack/internal/models"
)

type Handler struct {
	DB *gorm.DB
}

func New(db *gorm.DB) *Handler {
	return &Handler{DB: db}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]string{"error": msg, "code": code})
}

// createSnippetReq is the JSON shape accepted by Create. We keep this
// decoupled from the model so clients can send TTL + password in plain form.
type createSnippetReq struct {
	Title         string `json:"title"`
	Content       string `json:"content"`
	Language      string `json:"language"`
	Visibility    string `json:"visibility"`
	TTL           string `json:"ttl"` // "1h" | "1d" | "1w" | "30d" | "" (never)
	BurnAfterRead bool   `json:"burnAfterRead"`
	Password      string `json:"password"`
	IsEncrypted   bool   `json:"isEncrypted"`
}

// snippetView is the response shape. Hides content when locked.
type snippetView struct {
	ID             string     `json:"id"`
	Slug           string     `json:"slug"`
	Title          string     `json:"title"`
	Content        string     `json:"content,omitempty"`
	IsEncrypted    bool       `json:"isEncrypted"`
	Language       string     `json:"language"`
	Visibility     string     `json:"visibility"`
	ExpiresAt      *time.Time `json:"expiresAt,omitempty"`
	BurnAfterRead  bool       `json:"burnAfterRead"`
	PasswordLocked bool       `json:"passwordLocked"`
	ForkOfID       *string    `json:"forkOfId,omitempty"`
	ForkCount      int        `json:"forkCount"`
	CreatedAt      time.Time  `json:"createdAt"`
}

func toView(s *models.Snippet, withContent bool) snippetView {
	v := snippetView{
		ID:             s.ID,
		Slug:           s.Slug,
		Title:          s.Title,
		IsEncrypted:    s.IsEncrypted,
		Language:       s.Language,
		Visibility:     string(s.Visibility),
		ExpiresAt:      s.ExpiresAt,
		BurnAfterRead:  s.BurnAfterRead,
		PasswordLocked: s.PasswordHash != nil,
		ForkOfID:       s.ForkOfID,
		ForkCount:      s.ForkCount,
		CreatedAt:      s.CreatedAt,
	}
	if withContent {
		// Transparent decrypt for vault content.
		plain, err := crypto.Decrypt(s.Content)
		if err == nil {
			v.Content = plain
		}
	}
	return v
}

func parseTTL(ttl string) *time.Time {
	now := time.Now().UTC()
	var d time.Duration
	switch ttl {
	case "1h":
		d = time.Hour
	case "1d":
		d = 24 * time.Hour
	case "1w":
		d = 7 * 24 * time.Hour
	case "30d":
		d = 30 * 24 * time.Hour
	default:
		return nil
	}
	t := now.Add(d)
	return &t
}

func (h *Handler) ListSnippets(w http.ResponseWriter, r *http.Request) {
	var rows []models.Snippet
	q := h.DB.
		Where("visibility = ?", models.VisibilityPublic).
		Where("password_hash IS NULL").
		Where("burn_after_read = ?", false).
		Where("expires_at IS NULL OR expires_at > ?", time.Now().UTC()).
		Order("created_at DESC").
		Limit(50)
	if err := q.Find(&rows).Error; err != nil {
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]snippetView, 0, len(rows))
	for i := range rows {
		out = append(out, toView(&rows[i], false))
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) CreateSnippet(w http.ResponseWriter, r *http.Request) {
	var req createSnippetReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid_json", "invalid json")
		return
	}
	if req.Content == "" {
		writeErr(w, http.StatusBadRequest, "missing_content", "content is required")
		return
	}

	content := req.Content
	if req.IsEncrypted {
		enc, err := crypto.Encrypt(content)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "encrypt_error", err.Error())
			return
		}
		content = enc
	}

	s := models.Snippet{
		Slug:          makeSlug(req.Title),
		Title:         req.Title,
		Content:       content,
		IsEncrypted:   req.IsEncrypted,
		Language:      req.Language,
		Visibility:    models.Visibility(req.Visibility),
		BurnAfterRead: req.BurnAfterRead,
		ExpiresAt:     parseTTL(req.TTL),
	}
	if s.Visibility == "" {
		s.Visibility = models.VisibilityPublic
	}
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "hash_error", err.Error())
			return
		}
		ph := string(hash)
		s.PasswordHash = &ph
	}
	if err := h.DB.Create(&s).Error; err != nil {
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, toView(&s, true))
}

// loadSnippet fetches a snippet and enforces expiration. Returns (nil, true) if
// it 404'd / handled the response itself.
func (h *Handler) loadSnippet(w http.ResponseWriter, idOrSlug string) (*models.Snippet, bool) {
	s, err := h.findSnippet(idOrSlug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeErr(w, http.StatusNotFound, "not_found", "not found")
			return nil, true
		}
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return nil, true
	}
	if s.ExpiresAt != nil && s.ExpiresAt.Before(time.Now().UTC()) {
		_ = h.DB.Delete(s).Error
		writeErr(w, http.StatusGone, "expired", "snippet expired")
		return nil, true
	}
	return s, false
}

func (h *Handler) GetSnippet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, handled := h.loadSnippet(w, id)
	if handled {
		return
	}
	if s.PasswordHash != nil {
		// Don't reveal content; client must call /verify
		writeJSON(w, http.StatusOK, toView(s, false))
		return
	}
	view := toView(s, true)
	if s.BurnAfterRead {
		_ = h.DB.Delete(s).Error
	}
	writeJSON(w, http.StatusOK, view)
}

type verifyReq struct {
	Password string `json:"password"`
}

func (h *Handler) VerifySnippet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req verifyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid_json", "invalid json")
		return
	}
	s, handled := h.loadSnippet(w, id)
	if handled {
		return
	}
	if s.PasswordHash == nil {
		writeJSON(w, http.StatusOK, toView(s, true))
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*s.PasswordHash), []byte(req.Password)); err != nil {
		writeErr(w, http.StatusUnauthorized, "bad_password", "incorrect password")
		return
	}
	view := toView(s, true)
	if s.BurnAfterRead {
		_ = h.DB.Delete(s).Error
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *Handler) UpdateSnippet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var s models.Snippet
	if err := h.DB.First(&s, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeErr(w, http.StatusNotFound, "not_found", "not found")
			return
		}
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	var patch models.Snippet
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid_json", "invalid json")
		return
	}
	if err := h.DB.Model(&s).Updates(patch).Error; err != nil {
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, toView(&s, true))
}

func (h *Handler) DeleteSnippet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.DB.Delete(&models.Snippet{}, "id = ?", id).Error; err != nil {
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
