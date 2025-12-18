package variants

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/ollama"
)

const (
	// BatchSize is the number of products to process in each batch
	BatchSize = 1000
)

// Generator orchestrates the variant generation process
// Uses Ollama AI to extract base product names for grouping
type Generator struct {
	repo         *Repository
	grouper      *ProductGrouper
	analyzer     *PropertyAnalyzer
	ollamaClient *ollama.Client

	// Active job management
	mu            sync.RWMutex
	activeJob     *models.VariantGenerationJob
	activeContext context.Context
	cancelFunc    context.CancelFunc

	// SSE broadcast pattern - each subscriber gets their own channel
	subscribers   map[string]chan *models.VariantProgressUpdate
	subscribersMu sync.RWMutex
}

// NewGenerator creates a new variant generator with Ollama AI support
func NewGenerator(repo *Repository, ollamaClient *ollama.Client) *Generator {
	grouper := NewProductGrouper(ollamaClient)
	analyzer := NewPropertyAnalyzer()

	return &Generator{
		repo:         repo,
		grouper:      grouper,
		analyzer:     analyzer,
		ollamaClient: ollamaClient,
		subscribers:  make(map[string]chan *models.VariantProgressUpdate),
	}
}

// StartGeneration starts a new variant generation job
func (g *Generator) StartGeneration(ctx context.Context, clearExisting bool) (*models.VariantGenerationJob, error) {
	g.mu.Lock()

	// Check if already running (with database sync to handle stale in-memory state)
	if g.activeJob != nil && g.activeJob.Status == models.VariantJobStatusRunning {
		// Verify the job is actually still running in the database
		dbJob, err := g.repo.GetJob(ctx, g.activeJob.ID)
		if err != nil {
			log.Printf("Generator: Failed to verify active job status: %v", err)
		}
		if dbJob == nil || dbJob.Status != models.VariantJobStatusRunning {
			// Database says job is not running - clear stale in-memory state
			log.Printf("Generator: Clearing stale in-memory job state (job %s is %s in DB)",
				g.activeJob.ID, func() string {
					if dbJob == nil {
						return "not found"
					}
					return dbJob.Status
				}())
			g.activeJob = nil
			g.activeContext = nil
			g.cancelFunc = nil
		} else {
			g.mu.Unlock()
			return nil, fmt.Errorf("variant generation already in progress (job ID: %s)", g.activeJob.ID)
		}
	}

	// Check database for running jobs
	existingJob, err := g.repo.GetActiveJob(ctx)
	if err != nil {
		g.mu.Unlock()
		return nil, fmt.Errorf("checking for active jobs: %w", err)
	}
	if existingJob != nil {
		g.mu.Unlock()
		return nil, fmt.Errorf("variant generation already in progress (job ID: %s)", existingJob.ID)
	}

	// Clear existing groups if requested
	if clearExisting {
		log.Println("Generator: Clearing existing variant groups")
		if err := g.repo.ClearAllGroups(ctx); err != nil {
			g.mu.Unlock()
			return nil, fmt.Errorf("clearing existing groups: %w", err)
		}
	}

	// Get total product count
	_, total, err := g.repo.GetProductsForGenerationBatch(ctx, 1, 0)
	if err != nil {
		g.mu.Unlock()
		return nil, fmt.Errorf("counting products: %w", err)
	}

	if total == 0 {
		g.mu.Unlock()
		return nil, fmt.Errorf("no products found for variant generation")
	}

	// Create job
	job, err := g.repo.CreateJob(ctx, total)
	if err != nil {
		g.mu.Unlock()
		return nil, fmt.Errorf("creating job: %w", err)
	}

	// Create cancellable context
	jobCtx, cancel := context.WithCancel(context.Background())
	g.activeJob = job
	g.activeContext = jobCtx
	g.cancelFunc = cancel

	g.mu.Unlock()

	// Start processing in background
	go g.processGeneration(jobCtx, job)

	log.Printf("Generator: Started variant generation job %s for %d products", job.ID, total)

	return job, nil
}

// processGeneration runs the actual generation process
// Groups products by AI-extracted base name + category + brand
// Analyzes only Color, Storage, and RAM properties for variants
func (g *Generator) processGeneration(ctx context.Context, job *models.VariantGenerationJob) {
	// Mark job as running
	if err := g.repo.StartJob(ctx, job.ID); err != nil {
		log.Printf("Generator: Failed to start job: %v", err)
		g.completeJob(job, models.VariantJobStatusFailed, fmt.Sprintf("failed to start job: %v", err))
		return
	}

	job.Status = models.VariantJobStatusRunning
	now := time.Now()
	job.StartedAt = &now

	// Check if Ollama is available
	ollamaStatus := "unavailable"
	if g.ollamaClient != nil && g.ollamaClient.IsAvailable(ctx) {
		ollamaStatus = "connected"
	}

	// Send initial progress
	g.sendProgress(job, fmt.Sprintf("Starting variant generation (Ollama AI: %s)...", ollamaStatus))

	// Process in batches
	totalBatches := (job.TotalProducts + BatchSize - 1) / BatchSize
	allGroups := make(map[string]*GroupResult)

	for batch := 0; batch < totalBatches; batch++ {
		select {
		case <-ctx.Done():
			g.completeJob(job, models.VariantJobStatusCancelled, "job cancelled by user")
			return
		default:
		}

		offset := batch * BatchSize
		products, _, err := g.repo.GetProductsForGenerationBatch(ctx, BatchSize, offset)
		if err != nil {
			g.completeJob(job, models.VariantJobStatusFailed, fmt.Sprintf("failed to get products: %v", err))
			return
		}

		if len(products) == 0 {
			break
		}

		// Group products using AI-extracted base name + brand + category matching
		batchGroups, err := g.grouper.GroupProductsByAIExtractedName(ctx, products)
		if err != nil {
			log.Printf("Generator: Failed to group batch %d: %v", batch, err)
			// Continue with next batch instead of failing completely
			continue
		}

		// Merge batch groups into all groups
		for key, group := range batchGroups {
			if existing, ok := allGroups[key]; ok {
				existing.Products = append(existing.Products, group.Products...)
			} else {
				allGroups[key] = group
			}
		}

		// Update progress
		processed := min((batch+1)*BatchSize, job.TotalProducts)
		job.ProcessedProducts = processed

		if err := g.repo.UpdateJobProgress(ctx, job.ID, processed, 0); err != nil {
			log.Printf("Generator: Failed to update progress: %v", err)
		}

		g.sendProgress(job, fmt.Sprintf("Processing batch %d/%d...", batch+1, totalBatches))
	}

	// Filter out single-product groups
	filteredGroups := make(map[string]*GroupResult)
	for key, group := range allGroups {
		if len(group.Products) >= 2 {
			filteredGroups[key] = group
		}
	}

	log.Printf("Generator: Found %d variant groups with 2+ products (AI-extracted base names)", len(filteredGroups))

	// Save groups and analyze properties
	groupsCreated := 0
	groupsWithVariants := 0

	for _, groupResult := range filteredGroups {
		select {
		case <-ctx.Done():
			g.completeJob(job, models.VariantJobStatusCancelled, "job cancelled by user")
			return
		default:
		}

		// Get properties for analysis BEFORE creating the group
		// This allows us to skip groups that have no variant properties
		productIDs := make([]uuid.UUID, len(groupResult.Products))
		for i, p := range groupResult.Products {
			productIDs[i] = p.ID
		}

		properties, err := g.repo.GetPropertiesForProducts(ctx, productIDs)
		if err != nil {
			log.Printf("Generator: Failed to get properties for group %s: %v", groupResult.BaseName, err)
			continue
		}

		// Analyze variant properties (only Color, Storage, RAM)
		variantProps := g.analyzer.AnalyzeVariantProperties(groupResult.Products, properties)

		// Only create the group if it has at least one variant property
		if len(variantProps) == 0 {
			// Skip this group - products have same name/brand/category but no variant differences
			continue
		}

		// Create group
		group, err := g.repo.CreateGroup(ctx, groupResult.BaseName, groupResult.BaseNameNormalized)
		if err != nil {
			log.Printf("Generator: Failed to create group %s: %v", groupResult.BaseName, err)
			continue
		}

		// Add members
		for _, product := range groupResult.Products {
			if err := g.repo.AddMemberToGroup(ctx, group.ID, product.ID); err != nil {
				log.Printf("Generator: Failed to add member %s to group: %v", product.ID, err)
			}
		}

		// Save variant properties
		for _, prop := range variantProps {
			if err := g.repo.AddVariantProperty(ctx, group.ID, prop); err != nil {
				log.Printf("Generator: Failed to add variant property: %v", err)
			}
		}

		groupsCreated++
		groupsWithVariants++
		job.GroupsCreated = groupsCreated

		if err := g.repo.UpdateJobProgress(ctx, job.ID, job.ProcessedProducts, groupsCreated); err != nil {
			log.Printf("Generator: Failed to update groups count: %v", err)
		}

		if groupsCreated%100 == 0 {
			g.sendProgress(job, fmt.Sprintf("Created %d groups with variants...", groupsCreated))
		}
	}

	// Complete job
	g.completeJob(job, models.VariantJobStatusCompleted, "")

	log.Printf("Generator: Completed job %s - created %d groups with Color/Storage/RAM variants", job.ID, groupsCreated)
}

// completeJob marks a job as complete and cleans up
func (g *Generator) completeJob(job *models.VariantGenerationJob, status, errorMsg string) {
	var errPtr *string
	if errorMsg != "" {
		errPtr = &errorMsg
	}

	job.Status = status
	job.Error = errPtr
	now := time.Now()
	job.CompletedAt = &now

	if err := g.repo.CompleteJob(context.Background(), job.ID, status, errPtr); err != nil {
		log.Printf("Generator: Failed to complete job: %v", err)
	}

	g.sendProgress(job, fmt.Sprintf("Job %s: %s", status, errorMsg))

	// Clear active job
	g.mu.Lock()
	if g.activeJob != nil && g.activeJob.ID == job.ID {
		g.activeJob = nil
		g.activeContext = nil
		g.cancelFunc = nil
	}
	g.mu.Unlock()
}

// sendProgress sends a progress update to all subscribers via broadcast
func (g *Generator) sendProgress(job *models.VariantGenerationJob, message string) {
	percentComplete := 0.0
	if job.TotalProducts > 0 {
		percentComplete = float64(job.ProcessedProducts) / float64(job.TotalProducts) * 100
	}

	update := &models.VariantProgressUpdate{
		JobID:         job.ID,
		Status:        job.Status,
		Total:         job.TotalProducts,
		Processed:     job.ProcessedProducts,
		GroupsCreated: job.GroupsCreated,
		Percent:       percentComplete,
		Message:       message,
		Error:         job.Error,
		Timestamp:     time.Now(),
	}

	g.broadcast(update)
}

// Subscribe registers a new subscriber and returns a channel for receiving updates
func (g *Generator) Subscribe(subscriberID string) <-chan *models.VariantProgressUpdate {
	g.subscribersMu.Lock()
	defer g.subscribersMu.Unlock()

	// Create buffered channel for this subscriber
	ch := make(chan *models.VariantProgressUpdate, 100)
	g.subscribers[subscriberID] = ch

	log.Printf("Generator: Subscriber %s registered (total: %d)", subscriberID, len(g.subscribers))

	return ch
}

// Unsubscribe removes a subscriber and closes their channel
func (g *Generator) Unsubscribe(subscriberID string) {
	g.subscribersMu.Lock()
	defer g.subscribersMu.Unlock()

	if ch, ok := g.subscribers[subscriberID]; ok {
		close(ch)
		delete(g.subscribers, subscriberID)
		log.Printf("Generator: Subscriber %s unregistered (remaining: %d)", subscriberID, len(g.subscribers))
	}
}

// broadcast sends an update to all subscribers
func (g *Generator) broadcast(update *models.VariantProgressUpdate) {
	g.subscribersMu.RLock()
	defer g.subscribersMu.RUnlock()

	for id, ch := range g.subscribers {
		// Non-blocking send to each subscriber
		select {
		case ch <- update:
		default:
			// Channel full, skip this update for this subscriber
			log.Printf("Generator: Subscriber %s channel full, skipping update", id)
		}
	}
}

// CancelGeneration cancels a running job
func (g *Generator) CancelGeneration(jobID uuid.UUID) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.activeJob == nil || g.activeJob.ID != jobID {
		return fmt.Errorf("job %s is not currently running", jobID)
	}

	if g.cancelFunc != nil {
		g.cancelFunc()
	}

	return nil
}

// GetActiveJob returns the currently running job, if any
func (g *Generator) GetActiveJob() *models.VariantGenerationJob {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.activeJob
}

// GetAllowedVariantProperties returns the list of allowed variant properties
// This is useful for API responses to show what properties are used for variants
func (g *Generator) GetAllowedVariantProperties() []VariantPropertyConfig {
	return AllowedVariantProperties
}

// Shutdown gracefully shuts down the generator
func (g *Generator) Shutdown() {
	g.mu.Lock()
	if g.cancelFunc != nil {
		g.cancelFunc()
	}
	g.mu.Unlock()

	// Close all subscriber channels
	g.subscribersMu.Lock()
	for id, ch := range g.subscribers {
		close(ch)
		delete(g.subscribers, id)
	}
	g.subscribersMu.Unlock()
}

// BuildMatrixForGroup builds a variant matrix for a specific group
func (g *Generator) BuildMatrixForGroup(ctx context.Context, groupID uuid.UUID) (*models.VariantMatrix, error) {
	// Get member products
	products, err := g.repo.GetMemberProducts(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("getting member products: %w", err)
	}

	if len(products) == 0 {
		return nil, nil
	}

	// Get product IDs
	productIDs := make([]uuid.UUID, len(products))
	for i, p := range products {
		productIDs[i] = p.ID
	}

	// Get properties
	properties, err := g.repo.GetPropertiesForProducts(ctx, productIDs)
	if err != nil {
		return nil, fmt.Errorf("getting properties: %w", err)
	}

	// Analyze variant properties
	variantProps := g.analyzer.AnalyzeVariantProperties(products, properties)

	// Convert to VariantPropertyResult for matrix building
	variantResults := make([]*models.VariantPropertyResult, len(variantProps))
	for i, vp := range variantProps {
		variantResults[i] = vp
	}

	// Build matrix
	return g.analyzer.BuildVariantMatrix(products, properties, variantResults), nil
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
