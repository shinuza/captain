package handlers

import (
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"codeinstyle.io/captain/models"
	"codeinstyle.io/captain/utils"
	"github.com/gofiber/fiber/v2"
)

// ListPosts shows all posts for admin
func (h *AdminHandlers) ListPosts(c *fiber.Ctx) error {
	posts, err := h.repos.Posts.FindAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).Render("500", fiber.Map{})
	}

	// Get settings for timezone
	settings, err := h.repos.Settings.Get()
	if err != nil {
		return c.Status(http.StatusInternalServerError).Render("500", fiber.Map{})
	}

	// Load timezone from settings
	loc, err := time.LoadLocation(settings.Timezone)
	if err != nil {
		loc = time.UTC
	}

	// Convert post times to user timezone
	for i := range posts {
		posts[i].PublishedAt = posts[i].PublishedAt.In(loc)
	}

	return c.Render("admin_posts", fiber.Map{
		"title": "Posts",
		"posts": posts,
	})
}

// ShowCreatePost displays the post creation form
func (h *AdminHandlers) ShowCreatePost(c *fiber.Ctx) error {
	tags, err := h.repos.Tags.FindAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).Render("500", fiber.Map{})
	}

	return c.Render("admin_create_post", fiber.Map{
		"title": "Create Post",
		"tags":  tags,
	})
}

// CreatePost handles post creation
func (h *AdminHandlers) CreatePost(c *fiber.Ctx) error {

	// Get settings for timezone
	settings := c.Locals("settings").(*models.Settings)

	// Get the logged in user
	exists := c.Locals("user")
	if exists == nil {
		return c.Status(http.StatusInternalServerError).Render("admin_create_post", fiber.Map{
			"error": "User session not found",
		})
	}
	user := exists.(*models.User)

	// Parse multipart form
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(http.StatusBadRequest).Render("admin_create_post", fiber.Map{
			"error": "Invalid form data",
			"post":  &models.Post{},
		})
	}

	// Parse form data
	post, err := postFromForm(form, settings)
	post.AuthorID = user.ID

	if err != nil {
		fmt.Printf("Error parsing form: %v\n", err)
		return c.Status(http.StatusBadRequest).Render("admin_create_post", fiber.Map{
			"error": "Unable to parse form into post",
			"post":  &post,
		})
	}

	// Basic validation
	if post.Title == "" || post.Slug == "" || post.Content == "" {
		return c.Status(http.StatusBadRequest).Render("admin_create_post", fiber.Map{
			"error": "Title, slug and content are required",
			"post":  &post,
		})
	}

	// Handle tags
	tags := strings.Split(c.FormValue("tags"), ",")

	// Create post with transaction to ensure atomic operation
	if err := h.repos.Posts.Create(post); err != nil {
		return c.Status(http.StatusInternalServerError).Render("admin_create_post", fiber.Map{
			"error": "Failed to create post",
			"post":  &post,
		})
	}

	if err := h.repos.Posts.AssociateTags(post, tags); err != nil {
		fmt.Printf("Error associating tags: %v\n", err)
		return c.Status(http.StatusInternalServerError).Render("admin_create_post", fiber.Map{
			"error": "Failed to associate tags",
			"post":  &post,
		})
	}

	return c.Redirect("/admin/posts")
}

func (h *AdminHandlers) UpdatePost(c *fiber.Ctx) error {
	id := c.Params("id")
	settings := c.Locals("settings").(*models.Settings)
	tagID, err := utils.ParseUint(id)

	if err != nil {
		return c.Status(http.StatusBadRequest).Render("500", fiber.Map{})
	}

	post, err := h.repos.Posts.FindByID(tagID)
	if err != nil {
		return c.Status(http.StatusNotFound).Render("404", fiber.Map{})
	}

	loc, err := time.LoadLocation(settings.Timezone)
	if err != nil {
		loc = time.UTC
	}

	// Parse form data
	post.Title = c.FormValue("title")
	post.Slug = c.FormValue("slug")
	post.Content = c.FormValue("content")
	excerpt := c.FormValue("excerpt")
	post.PublishedAt, err = parseTime(c.FormValue("publishedAt"), loc)

	if excerpt != "" {
		post.Excerpt = &excerpt
	}

	if err != nil {
		return c.Status(http.StatusBadRequest).Render("admin_edit_post", fiber.Map{
			"error": "Unable to parse form into post",
			"post":  &post,
		})
	}

	// Basic validation
	if post.Title == "" || post.Slug == "" || post.Content == "" {
		return c.Status(http.StatusBadRequest).Render("admin_edit_post", fiber.Map{
			"error": "All fields are required",
			"post":  post,
		})
	}

	// Handle tags
	tags := strings.Split(c.FormValue("tags"), ",")

	// Update post with transaction to ensure atomic operation
	if err := h.repos.Posts.Update(post); err != nil {
		return c.Status(http.StatusInternalServerError).Render("admin_edit_post", fiber.Map{
			"error": "Failed to update post",
			"post":  post,
		})
	}

	if err := h.repos.Posts.AssociateTags(post, tags); err != nil {
		return c.Status(http.StatusInternalServerError).Render("admin_edit_post", fiber.Map{
			"error": "Failed to update tags",
			"post":  post,
		})
	}

	return c.Redirect("/admin/posts")
}

// ListPostsByTag shows all posts for a specific tag
func (h *AdminHandlers) ListPostsByTag(c *fiber.Ctx) error {
	id := c.Params("id")

	tagID, err := utils.ParseUint(id)

	if err != nil {
		return c.Status(http.StatusBadRequest).Render("500", fiber.Map{})
	}

	// Find the tag
	tag, err := h.repos.Tags.FindByID(tagID)
	if err != nil {
		return c.Status(http.StatusNotFound).Render("404", fiber.Map{})
	}

	posts, err := h.repos.Posts.FindByTag(tag.Slug)
	if err != nil {
		return c.Status(http.StatusInternalServerError).Render("500", fiber.Map{})
	}

	// Get settings for timezone
	settings, err := h.repos.Settings.Get()
	if err != nil {
		return c.Status(http.StatusInternalServerError).Render("500", fiber.Map{})
	}

	// Load timezone from settings
	loc, err := time.LoadLocation(settings.Timezone)
	if err != nil {
		loc = time.UTC
	}

	// Convert post times to user timezone
	for i := range posts {
		posts[i].PublishedAt = posts[i].PublishedAt.In(loc)
	}

	return c.Render("admin_tag_posts", fiber.Map{
		"title": fmt.Sprintf("Posts tagged with '%s'", tag.Name),
		"posts": posts,
		"tag":   tag,
	})
}

// ConfirmDeletePost shows deletion confirmation page
func (h *AdminHandlers) ConfirmDeletePost(c *fiber.Ctx) error {
	id := c.Params("id")
	tagID, err := utils.ParseUint(id)

	if err != nil {
		return c.Status(http.StatusBadRequest).Render("500", fiber.Map{})
	}

	post, err := h.repos.Posts.FindByID(tagID)
	if err != nil {
		return c.Status(http.StatusNotFound).Render("404", fiber.Map{})
	}

	return c.Render("admin_confirm_delete_post", fiber.Map{
		"title": "Confirm Delete Post",
		"post":  post,
	})
}

// DeletePost removes a post and its tag associations
func (h *AdminHandlers) DeletePost(c *fiber.Ctx) error {
	id := c.Params("id")
	tagID, err := utils.ParseUint(id)

	if err != nil {
		return c.Status(http.StatusBadRequest).Render("500", fiber.Map{})
	}

	post, err := h.repos.Posts.FindByID(tagID)
	if err != nil {
		return c.Status(http.StatusNotFound).Render("404", fiber.Map{})
	}

	if err := h.repos.Posts.Delete(post); err != nil {
		return c.Status(http.StatusInternalServerError).Render("500", fiber.Map{})
	}

	return c.JSON(fiber.Map{"message": "Post deleted successfully"})
}

func (h *AdminHandlers) EditPost(c *fiber.Ctx) error {
	var allTags []*models.Tag
	id := c.Params("id")
	tagID, err := utils.ParseUint(id)

	if err != nil {
		return c.Status(http.StatusBadRequest).Render("500", fiber.Map{})
	}

	post, err := h.repos.Posts.FindByID(tagID)
	if err != nil {
		return c.Status(http.StatusNotFound).Render("404", fiber.Map{})
	}

	allTags, err = h.repos.Tags.FindAll()
	if err != nil {
		return c.Status(http.StatusInternalServerError).Render("500", fiber.Map{})
	}

	// Get settings for timezone
	settings, err := h.repos.Settings.Get()
	if err != nil {
		return c.Status(http.StatusInternalServerError).Render("500", fiber.Map{})
	}

	// Load timezone from settings
	loc, err := time.LoadLocation(settings.Timezone)
	if err != nil {
		loc = time.UTC
	}

	// Convert post time to user timezone
	post.PublishedAt = post.PublishedAt.In(loc)

	return c.Render("admin_edit_post", fiber.Map{
		"title":    "Edit Post",
		"post":     post,
		"allTags":  allTags,
		"postTags": post.Tags,
	})
}

func postFromForm(form *multipart.Form, settings *models.Settings) (*models.Post, error) {
	post := &models.Post{
		Title:   form.Value["title"][0],
		Slug:    form.Value["slug"][0],
		Content: form.Value["content"][0],
		Excerpt: &form.Value["excerpt"][0],
	}

	if _, ok := form.Value["visible"]; ok {
		post.Visible = true
	}

	loc, err := time.LoadLocation(settings.Timezone)
	if err != nil {
		loc = time.UTC
	}
	publishedAt := form.Value["publishedAt"][0]
	parsedTime, err := parseTime(publishedAt, loc)
	post.PublishedAt = parsedTime

	return post, err
}

func parseTime(publishedAt string, loc *time.Location) (time.Time, error) {
	var err error
	var parsedTime time.Time

	if publishedAt != "" {
		// 2024-12-17T23:30
		parsedTime, err = time.ParseInLocation("2006-01-02T15:04", publishedAt, loc)
		if err != nil {
			return time.Time{}, errors.New("invalid date format")
		}
	} else {
		parsedTime = time.Now().In(loc)
	}

	return parsedTime, nil
}
