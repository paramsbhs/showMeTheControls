package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"controlsystemsplayground/backend/api"
)

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", corsMiddleware(api.HealthHandler))
	mux.HandleFunc("/api/simulate", corsMiddleware(api.SimulateHandler))

	addr := ":" + port
	fmt.Printf("Control Systems API listening on http://localhost%s\n", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
