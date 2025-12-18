package main

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"ultra-api-testing/internal/repository"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	// Load .env file
	_ = godotenv.Load()

	// Connect to database
	pool, err := connectDB()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	repo := repository.NewAdminUserRepository(pool)
	ctx := context.Background()

	command := os.Args[1]

	switch command {
	case "list", "ls":
		if err := listUsers(ctx, repo); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

	case "create", "add":
		if len(os.Args) < 4 {
			fmt.Fprintln(os.Stderr, "Error: create requires username and password")
			fmt.Fprintln(os.Stderr, "Usage: admin-users create <username> <password>")
			os.Exit(1)
		}
		username := os.Args[2]
		password := os.Args[3]
		if err := createUser(ctx, repo, username, password); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

	case "delete", "rm", "remove":
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "Error: delete requires username")
			fmt.Fprintln(os.Stderr, "Usage: admin-users delete <username>")
			os.Exit(1)
		}
		username := os.Args[2]
		if err := deleteUser(ctx, repo, username); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

	case "help", "-h", "--help":
		printUsage()

	default:
		fmt.Fprintf(os.Stderr, "Error: Unknown command '%s'\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Admin Users Management CLI")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  go run cmd/admin-users/main.go <command> [arguments]")
	fmt.Println()
	fmt.Println("Commands:")
	fmt.Println("  list, ls              List all admin users")
	fmt.Println("  create <user> <pass>  Create a new admin user")
	fmt.Println("  delete <username>     Delete an admin user")
	fmt.Println("  help                  Show this help message")
	fmt.Println()
	fmt.Println("Examples:")
	fmt.Println("  go run cmd/admin-users/main.go list")
	fmt.Println("  go run cmd/admin-users/main.go create admin secretpass123")
	fmt.Println("  go run cmd/admin-users/main.go delete olduser")
}

func connectDB() (*pgxpool.Pool, error) {
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "postgres")
	password := getEnv("DB_PASSWORD", "")
	dbname := getEnv("DB_NAME", "ultra-data")
	sslmode := getEnv("DB_SSLMODE", "disable")

	var dsn string
	if password == "" {
		dsn = fmt.Sprintf("host=%s port=%s user=%s dbname=%s sslmode=%s",
			host, port, user, dbname, sslmode)
	} else {
		dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			host, port, user, password, dbname, sslmode)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return pgxpool.New(ctx, dsn)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func listUsers(ctx context.Context, repo *repository.AdminUserRepository) error {
	users, err := repo.List(ctx)
	if err != nil {
		return fmt.Errorf("failed to list users: %w", err)
	}

	if len(users) == 0 {
		fmt.Println("No admin users found.")
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tUSERNAME\tCREATED AT\tUPDATED AT")
	fmt.Fprintln(w, "--\t--------\t----------\t----------")

	for _, user := range users {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n",
			user.ID.String()[:8]+"...",
			user.Username,
			user.CreatedAt.Format("2006-01-02 15:04"),
			user.UpdatedAt.Format("2006-01-02 15:04"),
		)
	}

	w.Flush()
	fmt.Printf("\nTotal: %d user(s)\n", len(users))
	return nil
}

func createUser(ctx context.Context, repo *repository.AdminUserRepository, username, password string) error {
	if len(username) < 3 {
		return fmt.Errorf("username must be at least 3 characters")
	}
	if len(password) < 6 {
		return fmt.Errorf("password must be at least 6 characters")
	}

	user, err := repo.Create(ctx, &repository.CreateAdminUserRequest{
		Username: username,
		Password: password,
	})
	if err != nil {
		if err == repository.ErrDuplicateAdminUsername {
			return fmt.Errorf("username '%s' already exists", username)
		}
		return fmt.Errorf("failed to create user: %w", err)
	}

	fmt.Printf("Admin user created successfully!\n")
	fmt.Printf("  ID:       %s\n", user.ID)
	fmt.Printf("  Username: %s\n", user.Username)
	fmt.Printf("  Created:  %s\n", user.CreatedAt.Format(time.RFC3339))
	return nil
}

func deleteUser(ctx context.Context, repo *repository.AdminUserRepository, username string) error {
	// First check if user exists
	_, err := repo.GetByUsername(ctx, username)
	if err != nil {
		if err == repository.ErrAdminUserNotFound {
			return fmt.Errorf("user '%s' not found", username)
		}
		return fmt.Errorf("failed to find user: %w", err)
	}

	// Confirm deletion
	fmt.Printf("Are you sure you want to delete user '%s'? [y/N]: ", username)
	var confirm string
	fmt.Scanln(&confirm)

	if confirm != "y" && confirm != "Y" && confirm != "yes" && confirm != "Yes" {
		fmt.Println("Deletion cancelled.")
		return nil
	}

	if err := repo.Delete(ctx, username); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	fmt.Printf("User '%s' deleted successfully.\n", username)
	return nil
}
