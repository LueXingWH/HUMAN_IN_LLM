package middleware

import (
	"bufio"
	"compress/gzip"
	"net"
	"net/http"
	"strings"
)

// gzipResponseWriter wraps an http.ResponseWriter and lazily enables gzip
// compression once the handler's Content-Type is known. Streaming responses
// (text/event-stream) and already-encoded responses are written through
// uncompressed, preserving per-chunk flush semantics.
type gzipResponseWriter struct {
	http.ResponseWriter
	gz       *gzip.Writer
	compress bool
	decided  bool
}

func (w *gzipResponseWriter) decide() {
	if w.decided {
		return
	}
	w.decided = true
	contentType := strings.ToLower(w.Header().Get("Content-Type"))
	if strings.HasPrefix(contentType, "text/event-stream") ||
		w.Header().Get("Content-Encoding") != "" {
		w.compress = false
		return
	}
	w.compress = true
	w.Header().Set("Content-Encoding", "gzip")
	w.Header().Del("Content-Length")
	w.gz = gzip.NewWriter(w.ResponseWriter)
}

func (w *gzipResponseWriter) WriteHeader(code int) {
	w.decide()
	if code == http.StatusNoContent || code == http.StatusNotModified {
		// Bodies are forbidden; drop the gzip encoding for these statuses.
		w.compress = false
		w.Header().Del("Content-Encoding")
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *gzipResponseWriter) Write(b []byte) (int, error) {
	if !w.decided {
		w.WriteHeader(http.StatusOK)
	}
	if w.compress {
		return w.gz.Write(b)
	}
	return w.ResponseWriter.Write(b)
}

func (w *gzipResponseWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		if w.compress {
			_ = w.gz.Flush()
		}
		f.Flush()
	}
}

func (w *gzipResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if h, ok := w.ResponseWriter.(http.Hijacker); ok {
		return h.Hijack()
	}
	return nil, nil, http.ErrNotSupported
}

func (w *gzipResponseWriter) Close() {
	if w.compress && w.gz != nil {
		_ = w.gz.Close()
	}
}

// Compression enables gzip for eligible responses. It is intentionally skipped
// for WebSocket upgrades and for clients that do not advertise gzip support.
func Compression() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !acceptsGzip(r) || isUpgradeRequest(r) {
				next.ServeHTTP(w, r)
				return
			}
			grw := &gzipResponseWriter{ResponseWriter: w}
			defer grw.Close()
			next.ServeHTTP(grw, r)
		})
	}
}

func acceptsGzip(r *http.Request) bool {
	return strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")
}

func isUpgradeRequest(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("Upgrade"), "websocket") ||
		strings.EqualFold(r.Header.Get("Connection"), "Upgrade")
}
