package main

import (
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"flapstack/internal/cleanup"
	"flapstack/internal/config"
	"flapstack/internal/handlers"
	"flapstack/internal/store"
)

func main() {
	cfg := config.Load()

	db, err := store.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	if err := store.AutoMigrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	// Start background cleanup job
	cleanup.Start(db, 15*time.Minute)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.FrontendOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-FlapStack-Pro"},
		AllowCredentials: true,
	}))

	h := handlers.New(db)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/snippets", func(r chi.Router) {
			r.Get("/", h.ListSnippets)
			r.Post("/", h.CreateSnippet)
			r.Get("/{id}", h.GetSnippet)
			r.Post("/{id}/verify", h.VerifySnippet)
			r.Put("/{id}", h.UpdateSnippet)
			r.Delete("/{id}", h.DeleteSnippet)
			r.Post("/{id}/fork", h.ForkSnippet)
			r.Get("/{id}/comments", h.ListComments)
			r.Post("/{id}/comments", h.CreateComment)
		})

	})

	log.Printf("listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatal(err)
	}
}
