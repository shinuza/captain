package server

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os"

	"codeinstyle.io/captain/config"
	"codeinstyle.io/captain/db"
	"codeinstyle.io/captain/flash"
	"codeinstyle.io/captain/handlers"
	"codeinstyle.io/captain/middleware"
	"codeinstyle.io/captain/repository"
	"codeinstyle.io/captain/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/session"
	"github.com/gofiber/storage/sqlite3"
	"github.com/gofiber/template/html/v2"
	"github.com/yalue/merged_fs"
	"gorm.io/gorm"
)

// Server represents the HTTP server and its dependencies
type Server struct {
	app    *fiber.App
	db     *gorm.DB
	config *config.Config
}

// New creates a new server instance
func New(db *gorm.DB, cfg *config.Config, embeddedFS embed.FS) (*Server, error) {
	var err error
	var adminStaticFS fs.FS
	var staticFS fs.FS
	themeName := cfg.Site.Theme
	repositories := repository.NewRepositories(db)
	sessionStorage := sqlite3.New(sqlite3.Config{Database: cfg.DB.Path})
	sessionStore := session.New(session.Config{
		Storage:        sessionStorage,
		CookieDomain:   cfg.Site.Domain,
		CookieHTTPOnly: true,
		CookieSameSite: "Lax",
		CookieSecure:   cfg.Site.SecureCookie,
	})

	// Load theme static files
	if adminStaticFS, staticFS, err = setupStatics(themeName, embeddedFS); err != nil {
		panic(fmt.Errorf("error setting up static files: %v", err))
	}

	// Load theme templates
	viewEngine, err := setupTemplates(themeName, embeddedFS)
	if err != nil {
		panic(fmt.Errorf("error setting up templates: %v", err))
	}

	// Create Fiber app with template engine
	app := fiber.New(fiber.Config{
		Views: viewEngine,
	})

	app.Use("/admin/static", filesystem.New(filesystem.Config{
		Root:   http.FS(adminStaticFS),
		Browse: false, // TODO: Set to true for development
	}))

	app.Use("/static", filesystem.New(filesystem.Config{
		Root:   http.FS(staticFS),
		Browse: false, // TODO: Set to true for development
	}))

	app.Use(recover.New(
		recover.Config{
			EnableStackTrace: true, // TODO: Set to false for production
		},
	))

	app.Use("/", middleware.RequireSetup(repositories))
	app.Use("/", middleware.LoadMenuItems(repositories))
	app.Use("/", middleware.LoadVersion(repositories))
	app.Use("/", middleware.LoadSettings(repositories))
	app.Use("/", middleware.LoadUserData(repositories, sessionStore))
	app.Use("/admin", flash.Middleware())
	app.Use("/admin", middleware.AuthRequired(repositories, sessionStore))

	publicApp := handlers.RegisterPublicRoutes(repositories, cfg, sessionStore)
	dynamicApp := handlers.RegisterDynamicRoutes(repositories, cfg)
	authApp := handlers.RegisterAuthRoutes(repositories, cfg, sessionStore)
	adminApp := handlers.RegisterAdminRoutes(repositories, cfg, sessionStore)

	app.Mount("/media", dynamicApp)
	app.Mount("/", adminApp)
	app.Mount("/", authApp)
	app.Mount("/", publicApp)

	return &Server{
		config: cfg,
		db:     db,
		app:    app,
	}, nil

}

// setupStatics sets up static files
func setupStatics(themeName string, embeddedFS embed.FS) (fs.FS, fs.FS, error) {
	var userStaticFS fs.FS

	// Serve embedded admin static files
	adminStaticFS, err := fs.Sub(embeddedFS, "embedded/admin/static")
	if err != nil {
		return nil, nil, fmt.Errorf("error setting up admin static files: %v", err)
	}

	themeStaticFS, err := fs.Sub(embeddedFS, "embedded/public/static")
	if err != nil {
		return nil, nil, fmt.Errorf("error setting up theme static files: %v", err)
	}

	if themeName != "default" {
		userStaticFS, err = fs.Sub(os.DirFS("./themes/"+themeName), "static")
		if err != nil {
			return nil, nil, fmt.Errorf("error setting up theme static files: %v", err)
		}
	}

	staticFS := merged_fs.MergeMultiple(userStaticFS, themeStaticFS)

	return adminStaticFS, staticFS, nil
}

// setupTemplates sets up the template engine
func setupTemplates(themeName string, embeddedFS embed.FS) (*html.Engine, error) {
	var userTemplatesFS fs.FS
	var templatesFS fs.FS

	// Serve embedded admin templates
	adminTemplatesFS, err := fs.Sub(embeddedFS, "embedded/admin/templates")
	if err != nil {
		return nil, fmt.Errorf("error setting up admin templates: %v", err)
	}

	defaultTemplatesFS, err := fs.Sub(embeddedFS, "embedded/public/templates")
	if err != nil {
		return nil, fmt.Errorf("error setting up theme templates: %v", err)
	}

	if themeName != "default" {
		userTemplatesFS, err = fs.Sub(os.DirFS("./themes/"+themeName), "templates")
		if err != nil {
			return nil, fmt.Errorf("error setting up theme templates: %v", err)
		}
	}

	if themeName != "" {
		templatesFS = merged_fs.MergeMultiple(adminTemplatesFS, userTemplatesFS)
	} else {
		templatesFS = merged_fs.MergeMultiple(adminTemplatesFS, defaultTemplatesFS)
	}

	engine := html.NewFileSystem(http.FS(templatesFS), ".tmpl")
	engine.AddFuncMap(utils.GetTemplateFuncs())

	return engine, nil
}

// Run starts the HTTP server
func (s *Server) Run() error {
	// Load theme based on config

	addr := fmt.Sprintf("%s:%d", s.config.Server.Host, s.config.Server.Port)
	fmt.Printf("Server running on http://%s\n", addr)
	return s.app.Listen(addr)
}

// InitDevDB initializes the development database with test data
func (s *Server) InitDevDB() error {
	return db.InsertTestData(s.db)
}
