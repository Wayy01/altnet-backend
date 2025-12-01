package ultra

import (
	"encoding/xml"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"
)

var (
	// Regex patterns for fixing malformed XML
	digitPattern        = regexp.MustCompile(`</?[0-9][-a-zA-Z0-9_:.]*>`) // Match tags starting with digits (only valid tag name chars)
	singleLetterPattern = regexp.MustCompile(`<([A-Z])(\s|>)`)
	ampersandPattern    = regexp.MustCompile(`&([A-Za-z][A-Za-z0-9]*)([^;\w])`)
)

// FixMalformedXML applies regex fixes to XML string
func FixMalformedXML(xmlData string) string {
	// Fix 1: Escape tags starting with digits (e.g., <394>, </394>) → &lt;394&gt;
	digitCount := 0
	xmlData = digitPattern.ReplaceAllStringFunc(xmlData, func(match string) string {
		digitCount++
		// Extract the tag content (remove < and >)
		content := strings.TrimPrefix(match, "<")
		content = strings.TrimSuffix(content, ">")
		return "&lt;" + content + "&gt;"
	})
	log.Printf("Fixed %d tags starting with digits", digitCount)

	// Fix 2: Escape single uppercase letters (e.g., <Y>)
	letterCount := 0
	xmlData = singleLetterPattern.ReplaceAllStringFunc(xmlData, func(match string) string {
		letterCount++
		return "&lt;" + match[1:] // match is "<Y " or "<Y>", we want "&lt;Y " or "&lt;Y>"
	})
	log.Printf("Fixed %d single letter tags", letterCount)

	// Fix 3: Escape bare < that aren't part of valid tags (< followed by space, special chars, or nothing)
	bareLeftAngle := regexp.MustCompile(`<(\s|$|[^a-zA-Z/!?])`)
	bareLeftCount := len(bareLeftAngle.FindAllString(xmlData, -1))
	xmlData = bareLeftAngle.ReplaceAllString(xmlData, "&lt;$1")
	log.Printf("Fixed %d bare left angles", bareLeftCount)

	// Fix 3b: Fix specific known typos that look like unclosed tags
	specificTypos := regexp.MustCompile(`<(opper|luminum)\b`)
	typoCount := len(specificTypos.FindAllString(xmlData, -1))
	xmlData = specificTypos.ReplaceAllString(xmlData, "&lt;$1")
	log.Printf("Fixed %d known typos", typoCount)

	// Fix 4: Escape bare > that aren't part of valid tags
	bareRightAngle := regexp.MustCompile(`([^a-zA-Z0-9\-_"'\s/])>`)
	xmlData = bareRightAngle.ReplaceAllString(xmlData, "$1&gt;")

	// Fix 5: Escape ALL unescaped ampersands
	// This is more aggressive but safer - replace & with &amp; everywhere except in valid entities
	validEntityPattern := regexp.MustCompile(`&(lt|gt|amp|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);`)

	// First, temporarily replace valid entities with placeholders
	placeholders := make(map[string]string)
	placeholderID := 0
	xmlData = validEntityPattern.ReplaceAllStringFunc(xmlData, func(match string) string {
		placeholder := fmt.Sprintf("__ENTITY_%d__", placeholderID)
		placeholders[placeholder] = match
		placeholderID++
		return placeholder
	})

	// Now replace all remaining & with &amp;
	xmlData = strings.ReplaceAll(xmlData, "&", "&amp;")

	// Restore the valid entities
	for placeholder, entity := range placeholders {
		xmlData = strings.ReplaceAll(xmlData, placeholder, entity)
	}

	return xmlData
}

// ParseXML parses fixed XML into struct
func ParseXML(xmlData string, v interface{}) error {
	// Save raw XML to file for debugging
	if err := os.WriteFile("/tmp/raw_products.xml", []byte(xmlData), 0644); err != nil {
		log.Printf("Warning: Failed to save raw XML: %v", err)
	}

	fixed := FixMalformedXML(xmlData)

	// Save fixed XML to file for debugging
	if err := os.WriteFile("/tmp/fixed_products.xml", []byte(fixed), 0644); err != nil {
		log.Printf("Warning: Failed to save fixed XML: %v", err)
	}

	// Try lenient decoding: decode XML and skip syntax errors if possible
	decoder := xml.NewDecoder(strings.NewReader(fixed))
	decoder.Strict = false                // Enable non-strict mode
	decoder.AutoClose = xml.HTMLAutoClose // Auto-close tags like HTML
	decoder.Entity = xml.HTMLEntity       // Use HTML entity map

	if err := decoder.Decode(v); err != nil {
		return fmt.Errorf("unmarshal XML: %w", err)
	}

	return nil
}
