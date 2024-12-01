package handlers

import (
	"html/template"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"codeinstyle.io/captain/config"
	"codeinstyle.io/captain/db"
	"codeinstyle.io/captain/utils"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// setupPublicRouter creates a test router with embedded templates
func setupPublicRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.SetFuncMap(utils.GetTemplateFuncs())

	// Create minimal templates for testing
	templates := template.Must(template.New("post.tmpl").Parse(`
		<article>
			<h1>{{ .post.Title }}</h1>
			<div>{{ .post.Content }}</div>
		</article>
	`))

	// Add error templates
	template.Must(templates.New("404.tmpl").Parse(`<h1>Not Found</h1>`))
	template.Must(templates.New("500.tmpl").Parse(`<h1>Internal Server Error</h1>`))
	template.Must(templates.New("posts.tmpl").Parse(`
		<div>
		{{ range .posts }}
			<article>
				<h2>{{ .Title }}</h2>
				<div>{{ .Content }}</div>
			</article>
		{{ end }}
		</div>
	`))

	router.SetHTMLTemplate(templates)
	return router
}

func TestPostHandlers_GetPostBySlug(t *testing.T) {
	database := db.SetupTestDB()
	cfg, err := config.InitConfig()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}
	handlers := NewPublicHandlers(database, cfg)

	// Setup router with test templates
	router := setupPublicRouter()

	// Register handler
	router.GET("/posts/:slug", handlers.GetPostBySlug)

	// Create test post
	post := &db.Post{
		Title:       "Test Post",
		Slug:        "test-post",
		Content:     "Test Content",
		PublishedAt: time.Now(),
		Visible:     true,
	}
	database.Create(post)

	tests := []struct {
		name       string
		slug       string
		wantStatus int
	}{
		{
			name:       "Existing post",
			slug:       "test-post",
			wantStatus: http.StatusOK,
		},
		{
			name:       "Non-existent post",
			slug:       "missing",
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/posts/"+tt.slug, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			if tt.wantStatus == http.StatusOK {
				assert.Contains(t, w.Body.String(), "Test Post")
				assert.Contains(t, w.Body.String(), "Test Content")
			}
		})
	}
}

func TestPostHandlers_ListPosts(t *testing.T) {
	database := db.SetupTestDB()
	cfg, err := config.InitConfig()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}
	handlers := NewPublicHandlers(database, cfg)

	// Setup router with test templates
	router := setupPublicRouter()

	// Register handler
	router.GET("/posts", handlers.ListPosts)

	// Create test posts
	posts := []db.Post{
		{
			Title:       "Test Post 1",
			Slug:        "test-post-1",
			Content:     "Test Content 1",
			PublishedAt: time.Now(),
			Visible:     true,
		},
		{
			Title:       "Test Post 2",
			Slug:        "test-post-2",
			Content:     "Test Content 2",
			PublishedAt: time.Now(),
			Visible:     true,
		},
	}

	for _, post := range posts {
		database.Create(&post)
	}

	// Test listing posts
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/posts", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Test Post 1")
	assert.Contains(t, w.Body.String(), "Test Post 2")
}
