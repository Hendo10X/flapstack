package config

import (
	"os"

	"github.com/joho/godotenv"
)

func init() {
	// Load .env.local first (Next.js convention), then .env. godotenv is
	// non-overriding, so later calls fill in vars the earlier file didn't set.
	_ = godotenv.Load(".env.local")
	_ = godotenv.Load(".env")
}

type Config struct {
	Port           string
	DatabaseURL    string
	FrontendOrigin string
	JWTSecret      string
}

func Load() Config {
	return Config{
		Port:           env("PORT", "8080"),
		DatabaseURL:    env("DATABASE_URL", "host=localhost user=postgres password=postgres dbname=flapstack port=5432 sslmode=disable"),
		FrontendOrigin: env("FRONTEND_ORIGIN", "http://localhost:3000"),
		JWTSecret:      env("JWT_SECRET", "dev-only-change-me"),
	}
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
