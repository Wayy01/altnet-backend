package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Database       DatabaseConfig
	Ultra          UltraConfig
	Server         ServerConfig
	Logging        LoggingConfig
	LibreTranslate LibreTranslateConfig
}

type LibreTranslateConfig struct {
	URL string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type UltraConfig struct {
	APIURL           string
	Username         string
	Password         string
	Timeout          time.Duration
	RequestInterval  time.Duration
	MaxRetries       int
	PollInterval     time.Duration
	PollTimeout      time.Duration
	XMLParserURL     string
	XMLParserEnabled bool
}

type ServerConfig struct {
	Port string
}

type LoggingConfig struct {
	Level  string
	Format string
}

func Load() (*Config, error) {
	// Load .env file if exists (ignore error if file doesn't exist)
	_ = godotenv.Load()

	cfg := &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", ""),
			DBName:   getEnv("DB_NAME", "ultra-data"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		Ultra: UltraConfig{
			APIURL:           getEnv("ULTRA_API_URL", ""),
			Username:         getEnv("ULTRA_API_USERNAME", ""),
			Password:         getEnv("ULTRA_API_PASSWORD", ""),
			Timeout:          getDuration("ULTRA_API_TIMEOUT", 60*time.Second),
			RequestInterval:  getDuration("ULTRA_API_REQUEST_INTERVAL", 1*time.Second),
			MaxRetries:       getEnvInt("ULTRA_API_MAX_RETRIES", 3),
			PollInterval:     getDuration("ULTRA_API_POLL_INTERVAL", 5*time.Second),
			PollTimeout:      getDuration("ULTRA_API_POLL_TIMEOUT", 5*time.Minute),
			XMLParserURL:     getEnv("XML_PARSER_URL", "http://localhost:4040/parse"),
			XMLParserEnabled: getEnvBool("XML_PARSER_ENABLED", false),
		},
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
		},
		Logging: LoggingConfig{
			Level:  getEnv("LOG_LEVEL", "info"),
			Format: getEnv("LOG_FORMAT", "json"),
		},
		LibreTranslate: LibreTranslateConfig{
			URL: getEnv("LIBRETRANSLATE_URL", "http://localhost:5000"),
		},
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.Ultra.APIURL == "" {
		return fmt.Errorf("ULTRA_API_URL is required")
	}
	if c.Ultra.Username == "" {
		return fmt.Errorf("ULTRA_API_USERNAME is required")
	}
	if c.Ultra.Password == "" {
		return fmt.Errorf("ULTRA_API_PASSWORD is required")
	}
	// DB_PASSWORD not required for local trust authentication
	return nil
}

func (c *Config) GetDSN() string {
	if c.Database.Password == "" {
		// Omit password for trust authentication
		return fmt.Sprintf(
			"host=%s port=%s user=%s dbname=%s sslmode=%s",
			c.Database.Host,
			c.Database.Port,
			c.Database.User,
			c.Database.DBName,
			c.Database.SSLMode,
		)
	}
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.Database.Host,
		c.Database.Port,
		c.Database.User,
		c.Database.Password,
		c.Database.DBName,
		c.Database.SSLMode,
	)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1" || value == "yes"
	}
	return defaultValue
}

func getDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
