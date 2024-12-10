package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"time"
)

// LocalProvider implements Provider interface for local filesystem storage
type LocalProvider struct {
	baseDir string
}

// NewLocalProvider creates a new LocalProvider
func NewLocalProvider(baseDir string) (*LocalProvider, error) {
	// Create base directory if it doesn't exist
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %v", err)
	}
	return &LocalProvider{baseDir: baseDir}, nil
}

// Save implements Provider.Save
func (p *LocalProvider) Save(file *multipart.FileHeader) (string, error) {
	// Generate unique filename with slugified name
	ext := filepath.Ext(file.Filename)
	name := file.Filename[:len(file.Filename)-len(ext)]
	filename := fmt.Sprintf("%d-%s%s", time.Now().Unix(), slugify(name), ext)
	filepath := filepath.Join(p.baseDir, filename)

	// Open source file
	src, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open source file: %v", err)
	}
	defer src.Close()

	// Create destination file
	dst, err := os.Create(filepath)
	if err != nil {
		return "", fmt.Errorf("failed to create destination file: %v", err)
	}
	defer dst.Close()

	// Copy file contents
	if _, err = io.Copy(dst, src); err != nil {
		return "", fmt.Errorf("failed to copy file: %v", err)
	}

	return filename, nil
}

// Delete implements Provider.Delete
func (p *LocalProvider) Delete(path string) error {
	fullPath := filepath.Join(p.baseDir, path)
	if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete file: %v", err)
	}
	return nil
}

// Get implements Provider.Get
func (p *LocalProvider) Get(path string) (io.ReadCloser, error) {
	fullPath := filepath.Join(p.baseDir, path)
	file, err := os.Open(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %v", err)
	}
	return file, nil
}
