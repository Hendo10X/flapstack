package handlers

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"flapstack/internal/models"
)

// freeMonthlyAILimit returns the per-IP monthly free AI limit. Defaults to 5;
// override with FREE_AI_LIMIT env var (useful while developing).
func freeMonthlyAILimit() int {
	if v := os.Getenv("FREE_AI_LIMIT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return 10
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		// First IP in the list is the original client.
		parts := strings.Split(fwd, ",")
		return strings.TrimSpace(parts[0])
	}
	if real := r.Header.Get("X-Real-IP"); real != "" {
		return real
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func identity(r *http.Request) string {
	if deviceID := r.Header.Get("X-FlapStack-Device-ID"); deviceID != "" {
		return deviceID
	}
	return clientIP(r)
}

func currentPeriod() string {
	return time.Now().UTC().Format("2006-01")
}

func (h *Handler) isPro(token string) bool {
	if token == "" {
		return false
	}
	var pt models.ProToken
	err := h.DB.First(&pt, "token = ? AND revoked_at IS NULL", token).Error
	return err == nil
}

// proTokenFromRequest reads the pro token from header or query.
func proTokenFromRequest(r *http.Request) string {
	if t := r.Header.Get("X-FlapStack-Pro"); t != "" {
		return t
	}
	return r.URL.Query().Get("token")
}

type aiUsageResp struct {
	Allowed   bool `json:"allowed"`
	Remaining int  `json:"remaining"`
	Limit     int  `json:"limit"`
	Pro       bool `json:"pro"`
}

// ClaimAIUsage atomically increments the caller's usage and tells the client
// whether they're allowed. Pro users always pass with -1 remaining (unlimited).
func (h *Handler) ClaimAIUsage(w http.ResponseWriter, r *http.Request) {
	token := proTokenFromRequest(r)
	if h.isPro(token) {
		writeJSON(w, http.StatusOK, aiUsageResp{Allowed: true, Remaining: -1, Limit: -1, Pro: true})
		return
	}

	id := identity(r)
	period := currentPeriod()

	// Upsert + increment in a single statement. Postgres ON CONFLICT keeps it atomic.
	row := models.AIUsage{IP: id, Period: period, Count: 1, UpdatedAt: time.Now().UTC()}
	err := h.DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "ip"}, {Name: "period"}},
		DoUpdates: clause.Assignments(map[string]any{
			"count":      gorm.Expr("ai_usages.count + 1"),
			"updated_at": time.Now().UTC(),
		}),
	}).Create(&row).Error
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	// Re-read to get the post-increment count.
	var cur models.AIUsage
	if err := h.DB.First(&cur, "ip = ? AND period = ?", id, period).Error; err != nil {
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	limit := freeMonthlyAILimit()
	remaining := limit - cur.Count
	if remaining < 0 {
		remaining = 0
	}
	allowed := cur.Count <= limit

	if !allowed {
		// We over-incremented; roll back so they don't keep losing quota on every refresh.
		h.DB.Model(&models.AIUsage{}).
			Where("ip = ? AND period = ?", id, period).
			Update("count", gorm.Expr("count - 1"))
		writeJSON(w, http.StatusPaymentRequired, aiUsageResp{
			Allowed: false, Remaining: 0, Limit: limit, Pro: false,
		})
		return
	}

	writeJSON(w, http.StatusOK, aiUsageResp{
		Allowed: true, Remaining: remaining, Limit: limit, Pro: false,
	})
}

// GetBillingMe returns the pro status of the caller. Used by the client to know
// whether to show the paywall.
func (h *Handler) GetBillingMe(w http.ResponseWriter, r *http.Request) {
	token := proTokenFromRequest(r)
	if h.isPro(token) {
		writeJSON(w, http.StatusOK, map[string]any{"pro": true})
		return
	}

	id := identity(r)
	period := currentPeriod()
	var cur models.AIUsage
	err := h.DB.First(&cur, "ip = ? AND period = ?", id, period).Error
	count := 0
	if err == nil {
		count = cur.Count
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	limit := freeMonthlyAILimit()
	remaining := limit - count
	if remaining < 0 {
		remaining = 0
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"pro":       false,
		"remaining": remaining,
		"limit":     limit,
	})
}

// PolarWebhook is a stub. It validates the standard Polar webhook signature
// header against POLAR_WEBHOOK_SECRET and on subscription.created /
// subscription.active events issues a ProToken.
//
// Replace the event-shape parsing with the real Polar SDK types when ready.
func (h *Handler) PolarWebhook(w http.ResponseWriter, r *http.Request) {
	secret := os.Getenv("POLAR_WEBHOOK_SECRET")
	if secret == "" {
		writeErr(w, http.StatusServiceUnavailable, "not_configured", "POLAR_WEBHOOK_SECRET not set")
		return
	}
	sig := r.Header.Get("Webhook-Signature")
	body := make([]byte, r.ContentLength)
	if _, err := r.Body.Read(body); err != nil && err.Error() != "EOF" {
		writeErr(w, http.StatusBadRequest, "read_error", err.Error())
		return
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	if sig == "" || !hmac.Equal([]byte(sig), []byte(expected)) {
		writeErr(w, http.StatusUnauthorized, "bad_signature", "invalid webhook signature")
		return
	}

	var event struct {
		Type string `json:"type"`
		Data struct {
			ID         string `json:"id"`
			CustomerID string `json:"customer_id"`
			Customer   struct {
				ID    string `json:"id"`
				Email string `json:"email"`
			} `json:"customer"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid_json", err.Error())
		return
	}

	switch event.Type {
	case "subscription.created", "subscription.active", "checkout.completed":
		token, err := randomToken()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "token_error", err.Error())
			return
		}
		pt := models.ProToken{
			Token:             token,
			PolarCustomerID:   event.Data.Customer.ID,
			PolarSubscription: event.Data.ID,
			Email:             event.Data.Customer.Email,
			CreatedAt:         time.Now().UTC(),
		}
		if err := h.DB.Create(&pt).Error; err != nil {
			writeErr(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
		// In a real integration you'd email this token or redirect the customer
		// through a success URL that bakes the token into a one-time link.
		writeJSON(w, http.StatusOK, map[string]string{"token": token})
		return
	case "subscription.canceled", "subscription.revoked":
		now := time.Now().UTC()
		h.DB.Model(&models.ProToken{}).
			Where("polar_subscription = ?", event.Data.ID).
			Update("revoked_at", &now)
	}
	w.WriteHeader(http.StatusOK)
}

func randomToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
