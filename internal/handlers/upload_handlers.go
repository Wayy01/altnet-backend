package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

const (
	// Upload limits
	MaxImageSizeBytes = 10 * 1024 * 1024  // 10MB
	MaxVideoSizeBytes = 100 * 1024 * 1024 // 100MB

	// Upload directories
	UploadBasePath  = "./uploads"
	ImageUploadPath = "./uploads/images"
	VideoUploadPath = "./uploads/videos"
)

// Allowed file types
var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/jpg":  true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

var allowedVideoTypes = map[string]bool{
	"video/mp4":       true,
	"video/webm":      true,
	"video/quicktime": true, // .mov
}

// UploadResponse represents the response after a successful upload
type UploadResponse struct {
	UUID        string `json:"uuid"`
	URL         string `json:"url"`
	Filename    string `json:"filename"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
}

// ensureUploadDirs creates the upload directories if they don't exist
func ensureUploadDirs() error {
	dirs := []string{UploadBasePath, ImageUploadPath, VideoUploadPath}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}
	return nil
}

// UploadImage handles POST /api/v1/upload/image
// @Summary Upload an image file
// @Description Uploads an image file to the server (max 10MB, jpg/png/webp/gif)
// @Tags Upload
// @Accept multipart/form-data
// @Produce json
// @Param file formance file true "Image file to upload"
// @Success 200 {object} UploadResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/upload/image [post]
func (h *Handler) UploadImage(w http.ResponseWriter, r *http.Request) {
	// Ensure upload directories exist
	if err := ensureUploadDirs(); err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to initialize upload directory", err.Error())
		return
	}

	// Limit request body size
	r.Body = http.MaxBytesReader(w, r.Body, MaxImageSizeBytes)

	// Parse multipart form
	if err := r.ParseMultipartForm(MaxImageSizeBytes); err != nil {
		h.respondError(w, http.StatusBadRequest, "File too large", fmt.Sprintf("Maximum size is %dMB", MaxImageSizeBytes/(1024*1024)))
		return
	}

	// Get the file from the form
	file, header, err := r.FormFile("file")
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Failed to get file from form", err.Error())
		return
	}
	defer file.Close()

	// Validate content type
	contentType := header.Header.Get("Content-Type")
	if !allowedImageTypes[contentType] {
		h.respondError(w, http.StatusBadRequest, "Invalid file type", "Allowed types: jpg, jpeg, png, webp, gif")
		return
	}

	// Generate unique filename
	fileUUID := uuid.New().String()
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		// Determine extension from content type
		switch contentType {
		case "image/jpeg", "image/jpg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/webp":
			ext = ".webp"
		case "image/gif":
			ext = ".gif"
		}
	}
	filename := fmt.Sprintf("%s%s", fileUUID, ext)
	filePath := filepath.Join(ImageUploadPath, filename)

	// Create destination file
	dst, err := os.Create(filePath)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create file", err.Error())
		return
	}
	defer dst.Close()

	// Copy file contents
	size, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(filePath) // Clean up on failure
		h.respondError(w, http.StatusInternalServerError, "Failed to save file", err.Error())
		return
	}

	// Build response
	response := UploadResponse{
		UUID:        fileUUID,
		URL:         fmt.Sprintf("/uploads/images/%s", filename),
		Filename:    filename,
		Size:        size,
		ContentType: contentType,
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": response,
	})
}

// UploadVideo handles POST /api/v1/upload/video
// @Summary Upload a video file
// @Description Uploads a video file to the server (max 100MB, mp4/webm/mov)
// @Tags Upload
// @Accept multipart/form-data
// @Produce json
// @Param file formance file true "Video file to upload"
// @Success 200 {object} UploadResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/upload/video [post]
func (h *Handler) UploadVideo(w http.ResponseWriter, r *http.Request) {
	// Ensure upload directories exist
	if err := ensureUploadDirs(); err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to initialize upload directory", err.Error())
		return
	}

	// Limit request body size
	r.Body = http.MaxBytesReader(w, r.Body, MaxVideoSizeBytes)

	// Parse multipart form
	if err := r.ParseMultipartForm(MaxVideoSizeBytes); err != nil {
		h.respondError(w, http.StatusBadRequest, "File too large", fmt.Sprintf("Maximum size is %dMB", MaxVideoSizeBytes/(1024*1024)))
		return
	}

	// Get the file from the form
	file, header, err := r.FormFile("file")
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Failed to get file from form", err.Error())
		return
	}
	defer file.Close()

	// Validate content type
	contentType := header.Header.Get("Content-Type")
	if !allowedVideoTypes[contentType] {
		h.respondError(w, http.StatusBadRequest, "Invalid file type", "Allowed types: mp4, webm, mov")
		return
	}

	// Generate unique filename
	fileUUID := uuid.New().String()
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		// Determine extension from content type
		switch contentType {
		case "video/mp4":
			ext = ".mp4"
		case "video/webm":
			ext = ".webm"
		case "video/quicktime":
			ext = ".mov"
		}
	}
	filename := fmt.Sprintf("%s%s", fileUUID, ext)
	filePath := filepath.Join(VideoUploadPath, filename)

	// Create destination file
	dst, err := os.Create(filePath)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create file", err.Error())
		return
	}
	defer dst.Close()

	// Copy file contents
	size, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(filePath) // Clean up on failure
		h.respondError(w, http.StatusInternalServerError, "Failed to save file", err.Error())
		return
	}

	// Build response
	response := UploadResponse{
		UUID:        fileUUID,
		URL:         fmt.Sprintf("/uploads/videos/%s", filename),
		Filename:    filename,
		Size:        size,
		ContentType: contentType,
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": response,
	})
}

// DeleteUploadedImage handles DELETE /api/v1/upload/image/{uuid}
// @Summary Delete an uploaded image
// @Description Deletes an uploaded image file by UUID
// @Tags Upload
// @Produce json
// @Param uuid path string true "File UUID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/upload/image/{uuid} [delete]
func (h *Handler) DeleteUploadedImage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	fileUUID := vars["uuid"]

	if fileUUID == "" {
		h.respondError(w, http.StatusBadRequest, "Invalid request", "UUID is required")
		return
	}

	// Find the file by UUID prefix
	files, err := filepath.Glob(filepath.Join(ImageUploadPath, fileUUID+".*"))
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to search for file", err.Error())
		return
	}

	if len(files) == 0 {
		h.respondError(w, http.StatusNotFound, "File not found", "No file with the specified UUID exists")
		return
	}

	// Delete the file(s)
	for _, file := range files {
		if err := os.Remove(file); err != nil {
			h.respondError(w, http.StatusInternalServerError, "Failed to delete file", err.Error())
			return
		}
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Image deleted successfully",
	})
}

// DeleteUploadedVideo handles DELETE /api/v1/upload/video/{uuid}
// @Summary Delete an uploaded video
// @Description Deletes an uploaded video file by UUID
// @Tags Upload
// @Produce json
// @Param uuid path string true "File UUID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/upload/video/{uuid} [delete]
func (h *Handler) DeleteUploadedVideo(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	fileUUID := vars["uuid"]

	if fileUUID == "" {
		h.respondError(w, http.StatusBadRequest, "Invalid request", "UUID is required")
		return
	}

	// Find the file by UUID prefix
	files, err := filepath.Glob(filepath.Join(VideoUploadPath, fileUUID+".*"))
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to search for file", err.Error())
		return
	}

	if len(files) == 0 {
		h.respondError(w, http.StatusNotFound, "File not found", "No file with the specified UUID exists")
		return
	}

	// Delete the file(s)
	for _, file := range files {
		if err := os.Remove(file); err != nil {
			h.respondError(w, http.StatusInternalServerError, "Failed to delete file", err.Error())
			return
		}
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Video deleted successfully",
	})
}

// UploadMultipleImages handles POST /api/v1/upload/images
// @Summary Upload multiple image files
// @Description Uploads multiple image files at once (max 10MB each)
// @Tags Upload
// @Accept multipart/form-data
// @Produce json
// @Param files formance file true "Image files to upload"
// @Success 200 {object} []UploadResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/upload/images [post]
func (h *Handler) UploadMultipleImages(w http.ResponseWriter, r *http.Request) {
	// Ensure upload directories exist
	if err := ensureUploadDirs(); err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to initialize upload directory", err.Error())
		return
	}

	// Limit request body size (10 files * 10MB max)
	r.Body = http.MaxBytesReader(w, r.Body, 10*MaxImageSizeBytes)

	// Parse multipart form
	if err := r.ParseMultipartForm(10 * MaxImageSizeBytes); err != nil {
		h.respondError(w, http.StatusBadRequest, "Request too large", err.Error())
		return
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		h.respondError(w, http.StatusBadRequest, "No files provided", "Please provide at least one file")
		return
	}

	var responses []UploadResponse
	var errors []string

	for _, header := range files {
		file, err := header.Open()
		if err != nil {
			errors = append(errors, fmt.Sprintf("Failed to open %s: %v", header.Filename, err))
			continue
		}

		// Validate content type
		contentType := header.Header.Get("Content-Type")
		if !allowedImageTypes[contentType] {
			errors = append(errors, fmt.Sprintf("Invalid file type for %s", header.Filename))
			file.Close()
			continue
		}

		// Validate size
		if header.Size > MaxImageSizeBytes {
			errors = append(errors, fmt.Sprintf("File %s exceeds maximum size", header.Filename))
			file.Close()
			continue
		}

		// Generate unique filename
		fileUUID := uuid.New().String()
		ext := filepath.Ext(header.Filename)
		if ext == "" {
			switch contentType {
			case "image/jpeg", "image/jpg":
				ext = ".jpg"
			case "image/png":
				ext = ".png"
			case "image/webp":
				ext = ".webp"
			case "image/gif":
				ext = ".gif"
			}
		}
		filename := fmt.Sprintf("%s%s", fileUUID, ext)
		filePath := filepath.Join(ImageUploadPath, filename)

		// Create destination file
		dst, err := os.Create(filePath)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Failed to create %s: %v", header.Filename, err))
			file.Close()
			continue
		}

		// Copy file contents
		size, err := io.Copy(dst, file)
		dst.Close()
		file.Close()

		if err != nil {
			os.Remove(filePath)
			errors = append(errors, fmt.Sprintf("Failed to save %s: %v", header.Filename, err))
			continue
		}

		responses = append(responses, UploadResponse{
			UUID:        fileUUID,
			URL:         fmt.Sprintf("/uploads/images/%s", filename),
			Filename:    filename,
			Size:        size,
			ContentType: contentType,
		})
	}

	result := map[string]interface{}{
		"data":   responses,
		"count":  len(responses),
		"errors": errors,
	}

	h.respondJSON(w, http.StatusOK, result)
}

// GetUploadedFile handles GET /api/v1/upload/info/{type}/{uuid}
// @Summary Get info about an uploaded file
// @Description Returns metadata about an uploaded file
// @Tags Upload
// @Produce json
// @Param type path string true "File type (image or video)"
// @Param uuid path string true "File UUID"
// @Success 200 {object} UploadResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/upload/info/{type}/{uuid} [get]
func (h *Handler) GetUploadedFile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	fileType := vars["type"]
	fileUUID := vars["uuid"]

	var basePath string
	switch fileType {
	case "image":
		basePath = ImageUploadPath
	case "video":
		basePath = VideoUploadPath
	default:
		h.respondError(w, http.StatusBadRequest, "Invalid file type", "Type must be 'image' or 'video'")
		return
	}

	// Find the file
	files, err := filepath.Glob(filepath.Join(basePath, fileUUID+".*"))
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to search for file", err.Error())
		return
	}

	if len(files) == 0 {
		h.respondError(w, http.StatusNotFound, "File not found", "No file with the specified UUID exists")
		return
	}

	// Get file info
	filePath := files[0]
	info, err := os.Stat(filePath)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to get file info", err.Error())
		return
	}

	filename := filepath.Base(filePath)
	ext := strings.ToLower(filepath.Ext(filename))

	var contentType string
	switch ext {
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".png":
		contentType = "image/png"
	case ".webp":
		contentType = "image/webp"
	case ".gif":
		contentType = "image/gif"
	case ".mp4":
		contentType = "video/mp4"
	case ".webm":
		contentType = "video/webm"
	case ".mov":
		contentType = "video/quicktime"
	}

	response := UploadResponse{
		UUID:        fileUUID,
		URL:         fmt.Sprintf("/uploads/%ss/%s", fileType, filename),
		Filename:    filename,
		Size:        info.Size(),
		ContentType: contentType,
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": response,
	})
}

// respondError and respondJSON helper methods should already exist in handlers.go
// If not, we include them here for completeness

func (h *Handler) respondUploadError(w http.ResponseWriter, statusCode int, message string, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":   message,
		"details": details,
	})
}
