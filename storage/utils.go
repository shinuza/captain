package storage

import (
	"regexp"
	"strings"
)

var (
	// nonAlphanumericRegex matches any character that is not alphanumeric, dash, or underscore
	nonAlphanumericRegex = regexp.MustCompile(`[^a-zA-Z0-9-_]`)
	// multiDashRegex matches multiple consecutive dashes
	multiDashRegex = regexp.MustCompile(`-+`)
)

// slugify converts a filename into a URL-friendly slug
// It removes special characters, replaces spaces with dashes, and ensures the result is safe for URLs
// The result is limited to 50 characters
func slugify(filename string) string {
	// Convert to lowercase
	slug := strings.ToLower(filename)

	// Replace any non-alphanumeric character with a dash
	slug = nonAlphanumericRegex.ReplaceAllString(slug, "-")

	// Replace multiple consecutive dashes with a single dash
	slug = multiDashRegex.ReplaceAllString(slug, "-")

	// Remove leading and trailing dashes
	slug = strings.Trim(slug, "-")

	// Limit to 50 characters, but don't cut in the middle of a word if possible
	if len(slug) > 50 {
		// Try to find the last dash before the 50th character
		lastDash := strings.LastIndex(slug[:50], "-")
		if lastDash > 0 {
			// Cut at the last dash
			slug = slug[:lastDash]
		} else {
			// If no dash found, just cut at 50
			slug = slug[:50]
		}
	}

	return slug
}
