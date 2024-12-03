package db

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	mathrand "math/rand/v2"
	"os"
	"time"

	"codeinstyle.io/captain/config"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(cfg *config.Config) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(cfg.DB.Path), &gorm.Config{
		Logger: logger.Default.LogMode(cfg.GetGormLogLevel()),
	})
	if err != nil {
		log.Fatal(err)
	}

	// Run migrations
	err = db.AutoMigrate(&Post{}, &Tag{}, &User{}, &Page{}, &MenuItem{})
	if err != nil {
		log.Fatal(err)
	}

	return db
}

func GetPosts(db *gorm.DB, limit int) ([]Post, error) {
	var posts []Post
	result := db.Preload("Tags").
		Preload("Author"). // Add Author preload
		Where("published_at <= ?", time.Now()).
		Where("visible = ?", true).
		Order("id desc").
		Limit(limit).
		Find(&posts)
	if result.Error != nil {
		return nil, result.Error
	}
	return posts, nil
}

func GetPostBySlug(db *gorm.DB, slug string) (Post, error) {
	var post Post
	result := db.Preload("Tags").
		Preload("Author"). // Add Author preload
		Where("slug = ?", slug).
		Where("published_at <= ?", time.Now()).
		Where("visible = ?", true).
		First(&post)
	if result.Error != nil {
		return post, result.Error
	}
	return post, nil
}

func GetUserByEmail(db *gorm.DB, email string) (*User, error) {
	var user User
	result := db.Where("email = ?", email).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func CreateUser(db *gorm.DB, user *User) error {
	user.SessionToken = nil // Explicitly set to nil for new users
	return db.Create(user).Error
}

// New function to generate random session token
func GenerateSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func GetUserByToken(db *gorm.DB, token string) (*User, error) {
	var user User
	result := db.Where("session_token = ?", token).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func UpdateUserSessionToken(db *gorm.DB, user *User) error {
	token, err := GenerateSessionToken()
	if err != nil {
		return err
	}
	user.SessionToken = &token
	return db.Save(user).Error
}

// Add helper function for random tag selection
func getRandomTags(tags []Tag, min, max int) []Tag {
	if len(tags) == 0 {
		return []Tag{}
	}

	// Get random count between min and max
	count := min + mathrand.IntN(max-min+1)
	if count > len(tags) {
		count = len(tags)
	}

	// Shuffle tags
	shuffled := make([]Tag, len(tags))
	copy(shuffled, tags)
	mathrand.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})

	return shuffled[:count]
}

type testData struct {
	Tags  []string   `json:"tags"`
	Posts []testPost `json:"posts"`
}

type testPost struct {
	Title       string `json:"title"`
	Slug        string `json:"slug"`
	Content     string `json:"content"`
	PublishedAt string `json:"publishedAt"`
	Visible     bool   `json:"visible"`
	Excerpt     string `json:"excerpt"`
}

func InsertTestData(db *gorm.DB) error {
	var count int64
	err := db.Model(&Post{}).Count(&count).Error
	if err != nil {
		return err
	}

	if count == 0 {
		// Create default author for test posts
		author := User{
			FirstName: "Test",
			LastName:  "Author",
			Email:     "test@example.com",
			Password:  "hashed_password", // In real app, this should be properly hashed
		}
		if err := db.FirstOrCreate(&author, User{Email: "test@example.com"}).Error; err != nil {
			return err
		}

		// Read test data
		data, err := os.ReadFile("data/test_posts.json")
		if err != nil {
			return err
		}

		var testData testData
		if err := json.Unmarshal(data, &testData); err != nil {
			return err
		}

		// Create tags
		tags := make([]Tag, len(testData.Tags))
		for i, name := range testData.Tags {
			tag := Tag{Name: name}
			if err := db.FirstOrCreate(&tag, Tag{Name: name}).Error; err != nil {
				return err
			}
			tags[i] = tag
		}

		// Create posts
		for _, p := range testData.Posts {
			// Parse relative date
			days := 0
			if n, err := fmt.Sscanf(p.PublishedAt, "-%dd", &days); err != nil || n != 1 {
				return fmt.Errorf("invalid publishedAt format: %s", p.PublishedAt)
			}

			post := Post{
				Title:       p.Title,
				Slug:        p.Slug,
				Content:     p.Content,
				PublishedAt: time.Now().AddDate(0, 0, -days),
				Visible:     p.Visible,
				Excerpt:     &p.Excerpt,
				Tags:        getRandomTags(tags, 2, 4),
				AuthorID:    author.ID, // Set the author ID for test posts
			}

			if err := db.Create(&post).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

// HasUsers checks if there are any users in the database
func HasUsers(db *gorm.DB) bool {
	var count int64
	db.Model(&User{}).Count(&count)
	return count > 0
}
