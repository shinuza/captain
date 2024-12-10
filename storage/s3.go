package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
)

// S3Provider implements Provider interface for AWS S3 storage
type S3Provider struct {
	client *s3.Client
	bucket string
}

// NewS3Provider creates a new S3Provider
func NewS3Provider(bucket, region, endpoint, access_key, secret_key string) (*S3Provider, error) {
	// Create custom resolver for endpoint if provided
	var endpointResolver aws.EndpointResolverWithOptions
	if endpoint != "" {
		endpointResolver = aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
			return aws.Endpoint{
				URL: endpoint,
			}, nil
		})
	}

	// Create config options
	opts := []func(*config.LoadOptions) error{
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(access_key, secret_key, "")),
	}

	// Add endpoint resolver if custom endpoint is provided
	if endpointResolver != nil {
		opts = append(opts, config.WithEndpointResolverWithOptions(endpointResolver))
	}

	// Load AWS configuration with options
	cfg, err := config.LoadDefaultConfig(context.TODO(), opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %v", err)
	}

	// Create S3 client
	client := s3.NewFromConfig(cfg)

	return &S3Provider{
		client: client,
		bucket: bucket,
	}, nil
}

// Save implements Provider.Save
func (p *S3Provider) Save(file *multipart.FileHeader) (string, error) {
	// Generate unique filename with slugified name
	ext := filepath.Ext(file.Filename)
	name := file.Filename[:len(file.Filename)-len(ext)]
	filename := fmt.Sprintf("%d-%s%s", time.Now().Unix(), slugify(name), ext)

	// Open source file
	src, err := file.Open()
	if err != nil {
		fmt.Printf("Failed to open source file %s: %v\n", file.Filename, err)
		return "", fmt.Errorf("failed to open source file: %v", err)
	}
	defer src.Close()

	// Upload to S3
	_, err = p.client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: aws.String(p.bucket),
		Key:    aws.String(filename),
		Body:   src,
	})
	if err != nil {
		var ae smithy.APIError
		if errors.As(err, &ae) {
			fmt.Printf("Failed to upload file %s to S3: %s (%s)\n", filename, ae.ErrorMessage(), ae.ErrorCode())
		} else {
			fmt.Printf("Failed to upload file %s to S3: %v\n", filename, err)
		}
		return "", fmt.Errorf("failed to upload file to S3: %v", err)
	}

	fmt.Printf("Successfully uploaded file %s to S3 bucket %s\n", filename, p.bucket)
	return filename, nil
}

// Delete implements Provider.Delete
func (p *S3Provider) Delete(path string) error {
	_, err := p.client.DeleteObject(context.TODO(), &s3.DeleteObjectInput{
		Bucket: aws.String(p.bucket),
		Key:    aws.String(path),
	})
	if err != nil {
		var ae smithy.APIError
		if errors.As(err, &ae) {
			fmt.Printf("Failed to delete file %s from S3: %s (%s)\n", path, ae.ErrorMessage(), ae.ErrorCode())
		} else {
			fmt.Printf("Failed to delete file %s from S3: %v\n", path, err)
		}
		return fmt.Errorf("failed to delete file from S3: %v", err)
	}

	fmt.Printf("Successfully deleted file %s from S3 bucket %s\n", path, p.bucket)
	return nil
}

// Get implements Provider.Get
func (p *S3Provider) Get(path string) (io.ReadCloser, error) {
	result, err := p.client.GetObject(context.TODO(), &s3.GetObjectInput{
		Bucket: aws.String(p.bucket),
		Key:    aws.String(path),
	})
	if err != nil {
		var ae smithy.APIError
		if errors.As(err, &ae) {
			fmt.Printf("Failed to get file %s from S3: %s (%s)\n", path, ae.ErrorMessage(), ae.ErrorCode())
			if ae.ErrorCode() == "NoSuchKey" {
				return nil, fmt.Errorf("file not found: %s", path)
			}
		} else {
			fmt.Printf("Failed to get file %s from S3: %v\n", path, err)
		}
		return nil, fmt.Errorf("failed to get file from S3: %v", err)
	}

	return result.Body, nil
}
