package auth

import (
	"context"
	"net/http"
)

type ctxKey string

const userCtxKey ctxKey = "user"

func WithUser(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userCtxKey, userID)
}

func UserID(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(userCtxKey).(string)
	return v, ok
}

// Middleware is a placeholder. Wire JWT verification here once auth lands.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}
