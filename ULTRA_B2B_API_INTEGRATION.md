# IT-Ultra B2B API Integration Documentation

## Table of Contents
1. [Overview](#overview)
2. [Configuration](#configuration)
3. [API Architecture](#api-architecture)
4. [Available Data Services](#available-data-services)
5. [Data Fetching Workflow](#data-fetching-workflow)
6. [XML Parsing Challenges](#xml-parsing-challenges)
7. [Data Structures](#data-structures)
8. [Translation Service](#translation-service)
9. [Image URL Construction](#image-url-construction)
10. [Database Storage](#database-storage)

---

## Overview

The IT-Ultra B2B API integration provides access to a comprehensive product catalog via a SOAP-based web service. This integration fetches brands, categories, products, prices, and stock information from the IT-Ultra supplier system.

### Key Features
- **SOAP-based API**: Uses WSDL endpoint for communication
- **Asynchronous Data Retrieval**: Request → Poll → Fetch → Commit workflow
- **Multi-source Architecture**: Data stored separately from Intelect FTP source
- **Automatic Translation**: English product names translated to Romanian using Google Cloud Translation API
- **CDN Image URLs**: Automatic construction of image URLs from UUIDs
- **Rich Product Data**: Prices, stock, characteristics (variants), properties, barcodes stored as JSONB

**Location**: `internal/sync/sources/ultra.go`, `internal/b2b/`

---

## Configuration

### Environment Variables

Configure the B2B API in your `.env` file:

```bash
# B2B API Connection
B2B_API_URL=https://portal.it-ultra.com/b2b/ws/b2b.1cws?wsdl
B2B_API_USERNAME=your_username
B2B_API_PASSWORD=your_password

# B2B API Timeouts & Retry
B2B_API_TIMEOUT=60s                    # HTTP request timeout
B2B_API_REQUEST_INTERVAL=1s            # Rate limiting between requests
B2B_API_MAX_RETRIES=3                  # Max retry attempts
B2B_API_POLL_INTERVAL=5s               # How often to check if data is ready
B2B_API_POLL_TIMEOUT=5m                # Max time to wait for data preparation

# Google Cloud Translation API (for English → Romanian)
GOOGLE_TRANSLATE_API_KEY=your_api_key
GOOGLE_TRANSLATE_API_URL=https://translation.googleapis.com/language/translate/v2
```

### Configuration Structure

```go
type B2BConfig struct {
    Endpoint        string        // WSDL endpoint URL
    Username        string        // B2B API username
    Password        string        // B2B API password
    Timeout         time.Duration // Request timeout (default: 60s)
    RequestInterval time.Duration // Rate limiting interval (default: 1s)
    MaxRetries      int           // Max retry attempts (default: 3)
    PollInterval    time.Duration // Polling interval (default: 5s)
    PollTimeout     time.Duration // Max wait time (default: 5m)
}
```

**File**: `internal/config/config.go:61-70`

---

## API Architecture

### SOAP Protocol

The IT-Ultra B2B API uses SOAP (Simple Object Access Protocol) over HTTP with Basic Authentication.

#### SOAP Request Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns1:requestData xmlns:ns1="http://ultra.b2b.md">
      <Service>NOMENCLATURE</Service>
      <all>true</all>
      <additionalParameters></additionalParameters>
      <compress>false</compress>
    </ns1:requestData>
  </soap:Body>
</soap:Envelope>
```

#### SOAP Response Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <requestDataResponse>
      <return>550e8400-e29b-41d4-a716-446655440000</return>
    </requestDataResponse>
  </soap:Body>
</soap:Envelope>
```

### Authentication

HTTP Basic Authentication is used for all requests:
```go
httpReq.SetBasicAuth(c.config.Username, c.config.Password)
```

**File**: `internal/b2b/client.go:380`

---

## Available Data Services

The B2B API provides 7 different services (data types):

| Service Constant | API Name | Description | XML Root Element |
|-----------------|----------|-------------|-----------------|
| `RequestTypeProducts` | `NOMENCLATURE` | Products with attributes, characteristics, images | `<nomenclatureList>` |
| `RequestTypeBrands` | `BRAND` | Brand list with attributes and images | `<brandList>` |
| `RequestTypeCategories` | `NOMENCLATURETYPELIST` | Product categories/groups | `<nomenclatureTypeList>` |
| `RequestTypePrices` | `PRICELIST` | Multi-currency prices by product+variant | `<priceList>` |
| `RequestTypeStock` | `BALANCE` | Stock quantities by warehouse | `<balanceList>` |
| `RequestTypeCharacteristics` | `PROPERTIES` | Product property definitions (skipped for performance) | `<nomenclaturePropertyList>` |
| `RequestTypeRates` | `RATES` | Currency exchange rates | `<ratesList>` |

**File**: `internal/b2b/types.go:59-68`

---

## Data Fetching Workflow

### Asynchronous Request Cycle

The B2B API uses an asynchronous request model:

```
1. REQUEST   → Call requestData(), get requestID
2. POLL      → Call isReady(requestID) every 5s until true
3. FETCH     → Call getDataByID(requestID), get Base64/XML data
4. COMMIT    → Call CommitReceivingData() to acknowledge receipt
```

### Complete Fetch Example

```go
// Step 1: Request data
requestID, err := client.RequestData(ctx, b2b.RequestTypeProducts)
// Response: "550e8400-e29b-41d4-a716-446655440000"

// Step 2: Wait for data to be ready (polls every 5s)
err := client.WaitForReady(ctx, requestID)
// Polls: isReady(requestID) → false, false, false... true

// Step 3: Get the data
xmlData, err := client.GetData(ctx, requestID)
// Response: HTML-escaped XML string

// Step 4: Commit receiving
err := client.CommitReceiving(ctx, b2b.RequestTypeProducts)
```

**File**: `internal/b2b/client.go:301-327`

### High-Level Fetch Methods

For convenience, use `FetchDataAsync()` which handles the entire cycle:

```go
xmlData, err := b2bClient.FetchDataAsync(ctx, b2b.RequestTypeProducts)
```

---

## XML Parsing Challenges

### Problem: Malformed XML from API

The IT-Ultra B2B API returns **malformed XML** that works with lenient JavaScript parsers (xml2js) but fails with strict Go parsers:

1. **Unescaped ampersands**: `B&O` instead of `B&amp;O`
2. **Invalid tag names**: `<29dBA>` (XML tags cannot start with digits)
3. **Unescaped `<` in text**: `Noise: <25dBA` in descriptions

### Solution 1: Go Regex Preprocessing

For simple services (brands, categories, prices, stock), we use Go regex to fix XML:

```go
func fixMalformedXMLEntities(xmlData string) string {
    // Fix 1: Escape < followed by digit → &lt;
    digitPattern := regexp.MustCompile(`<([0-9])`)
    xmlData = digitPattern.ReplaceAllString(xmlData, "&lt;$1")

    // Fix 2: Escape single uppercase letters (e.g., <Y>)
    singleLetterPattern := regexp.MustCompile(`<([A-Z])(\s|>)`)
    xmlData = singleLetterPattern.ReplaceAllString(xmlData, "&lt;$1$2")

    // Fix 3: Escape unescaped &
    pattern := regexp.MustCompile(`&([A-Za-z][A-Za-z0-9]*)([^;\w])`)
    xmlData = pattern.ReplaceAllStringFunc(xmlData, func(match string) string {
        // Check if valid entity (lt, gt, amp, quot, apos)
        if !isValidEntity(match) {
            return "&amp;" + entityName + followingChar
        }
        return match
    })

    return xmlData
}
```

**File**: `internal/sync/sources/ultra.go:72-144`

### Solution 2: Node.js xml2js Microservice

For complex services (NOMENCLATURE with nested structures), we use a Node.js microservice with the lenient `xml2js` library:

**Service URL**: `http://localhost:4040/parse`

**Request**:
```
POST /parse
Content-Type: text/xml

<nomenclatureList>...</nomenclatureList>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "nomenclatureList": {
      "nomenclature": [...]
    }
  },
  "meta": {
    "parseTime": 123,
    "inputSize": 45678
  }
}
```

**Why xml2js?**
- Lenient parsing (ignores malformed entities)
- Handles invalid tag names gracefully
- `explicitArray: false` simplifies structure
- Battle-tested with this specific API

**File**: `internal/sync/sources/ultra.go:147-192`

---

## Data Structures

### 1. NOMENCLATURE (Products)

#### XML Structure
```xml
<nomenclatureList>
  <nomenclature>
    <UUID>550e8400-e29b-41d4-a716-446655440000</UUID>
    <name>Samsung Galaxy S23 Ultra</name>
    <code>SM-S918B</code>
    <article>SM-S918B/DS</article>
    <parent></parent>
    <nomenclatureType>category-uuid</nomenclatureType>
    <brand>brand-uuid</brand>
    <active>true</active>
    <service>false</service>
    <warranty>24</warranty>
    <mainImage>image-uuid</mainImage>
    <characteristicList>
      <characteristic>
        <UUID>char-uuid</UUID>
        <name>Black 256GB</name>
        ...
      </characteristic>
    </characteristicList>
    <propertyList>
      <propertyValue>
        <property>
          <UUID>prop-uuid</UUID>
          <name>Screen Size</name>
        </property>
        <value>
          <type>string</type>
          <simpleValue>6.8 inches</simpleValue>
        </value>
      </propertyValue>
    </propertyList>
    <imageList>
      <image>
        <UUID>image-uuid</UUID>
        <name>Front view</name>
        <pathGlobal></pathGlobal>
      </image>
    </imageList>
    <barcodeList>
      <barcode>
        <code>8806094807325</code>
        <type>EAN13</type>
      </barcode>
    </barcodeList>
  </nomenclature>
</nomenclatureList>
```

#### Go Structure
```go
type B2BProduct struct {
    UUID               string               // Product UUID
    Name               string               // Product name (English)
    Code               string               // Product code
    Article            string               // Article/SKU
    Parent             string               // Parent UUID (hierarchy)
    NomenclatureType   string               // Category UUID
    Brand              string               // Brand UUID
    Active             FlexBool             // Is active
    Service            FlexBool             // Is service product
    Warranty           string               // Warranty (e.g., "24" months)
    MainImage          string               // Main image UUID
    ImageIds           []string             // Image UUIDs array
    CharacteristicList []B2BCharacteristic  // Product variants
    PropertyList       []B2BPropertyValue   // Properties
    ImageList          []B2BImage           // Images
    BarcodeList        []B2BBarcode         // Barcodes
}
```

**File**: `internal/b2b/types.go:71-91`

---

### 2. BRAND (Brands)

#### XML Structure
```xml
<brandList>
  <brand>
    <UUID>brand-uuid</UUID>
    <name>Samsung</name>
    <code>SAMSUNG</code>
  </brand>
</brandList>
```

#### Go Structure
```go
type B2BBrand struct {
    ID          string
    Name        string
    Description string
    LogoURL     string
    Active      FlexBool
}
```

**Fetched**: 200-300 brands
**File**: `internal/sync/sources/ultra.go:216-256`

---

### 3. NOMENCLATURETYPELIST (Categories)

#### XML Structure
```xml
<nomenclatureTypeList>
  <nomenclatureType>
    <UUID>category-uuid</UUID>
    <name>Smartphones</name>
    <code>SMARTPHONES</code>
    <parent>parent-category-uuid</parent>
    <orderBy>1</orderBy>
    <active>true</active>
    <quantity>1234</quantity>
  </nomenclatureType>
</nomenclatureTypeList>
```

#### Go Structure
```go
type B2BCategory struct {
    ID          string
    ParentID    string
    Name        string       // English name
    Description string
    Position    int
    Active      FlexBool
    Children    []B2BCategory
}
```

**Fetched**: 300-500 categories
**Translation**: English → Romanian using Google Cloud Translation API
**File**: `internal/sync/sources/ultra.go:258-351`

---

### 4. PRICELIST (Prices)

#### XML Structure
```xml
<priceList>
  <price>
    <UUID>product-uuid</UUID>
    <Characteristic>characteristic-uuid</Characteristic>
    <Price>1299.99</Price>
    <PriceType>
      <UUID>price-type-uuid</UUID>
      <name>Retail</name>
      <currency>
        <UUID>currency-uuid</UUID>
        <name>USD</name>
        <code>USD</code>
      </currency>
    </PriceType>
  </price>
</priceList>
```

#### Go Structure
```go
type B2BPrice struct {
    UUID           string       // Product UUID
    Characteristic string       // Variant UUID (empty for base product)
    Price          float64      // Price value
    PriceType      B2BPriceType // Price type with currency
}

type B2BPriceType struct {
    UUID     string
    Name     string       // "Retail", "Wholesale", etc.
    Currency B2BValute    // Currency info
}

type B2BValute struct {
    UUID string
    Name string  // "USD", "MDL", "EUR"
    Code string
}
```

**Indexing**: Prices indexed by `productUUID + "|" + characteristicUUID` for fast lookup
**File**: `internal/sync/sources/ultra.go:619-651`

---

### 5. BALANCE (Stock)

#### XML Structure
```xml
<balanceList>
  <balance>
    <UUID>product-uuid</UUID>
    <name>Samsung Galaxy S23 Ultra</name>
    <code>SM-S918B</code>
    <Characteristic>characteristic-uuid</Characteristic>
    <quantity>50</quantity>
    <quantityShowroom>5</quantityShowroom>
  </balance>
</balanceList>
```

#### Go Structure
```go
type B2BBalance struct {
    UUID              string  // Product UUID
    Name              string  // Product name
    Code              string  // Product code
    Characteristic    string  // Variant UUID
    Quantity          float64 // Warehouse stock
    QuantityShowroom  float64 // Showroom stock
}
```

**Indexing**: Stock indexed by `productUUID` only (aggregates all variants)
**Total Stock**: `quantity + quantityShowroom`
**File**: `internal/sync/sources/ultra.go:656-712`

---

### 6. PROPERTIES (Product Properties) - SKIPPED

**Status**: SKIPPED for performance reasons

Originally intended to fetch detailed property definitions filtered by product group UUID. However:
- Takes ~30 minutes to fetch (354 groups × 5s each)
- Returns mostly empty data
- Not critical for price/stock updates

**Decision**: User confirmed PROPERTIES data is not essential. Empty map initialized to prevent nil pointer errors.

**File**: `internal/sync/sources/ultra.go:570-616`

---

## Translation Service

### Overview

Product and category names from Ultra B2B API are in **English**. We translate them to **Romanian** using Google Cloud Translation API.

### Translation Methods

#### 1. Batch Translation (Products)

For performance, product names are translated in batches using Google's batch API (up to 128 texts per request):

```go
// Collect all product names
productNames := make([]string, len(nomenclatures))
for i, product := range nomenclatures {
    productNames[i] = product.Name
}

// Translate all names in batches
translatedNames := translator.TranslateBatch(ctx, productNames, "en", "ro")

// Cache results
for i, product := range nomenclatures {
    lastTranslatedNames[product.UUID] = translatedNames[i]
}
```

**Batch Size**: 128 texts per API request
**Source Language**: English (`en`)
**Target Language**: Romanian (`ro`)

**File**: `internal/sync/sources/ultra.go:722-738`

#### 2. Individual Translation (Categories)

Categories are translated one-by-one with progress tracking:

```go
translator.StartProgress("Ultra Categories", len(categories))

for i, category := range categories {
    translatedName := translator.Translate(ctx, category.Name, "en", "ro")
    categories[i].Name = translatedName
}

translator.ResetProgress()
```

**File**: `internal/sync/sources/ultra.go:313-348`

#### 3. Smart Translation Fallback

The `SmartTranslate()` method handles translation with fallback logic:

```go
func (s *TranslatorService) SmartTranslate(ctx context.Context, text string) string {
    if !s.IsEnabled() {
        return text // Return original if translation disabled
    }

    translated := s.Translate(ctx, text, "en", "ro")
    if translated == "" {
        return text // Return original if translation failed
    }

    return translated
}
```

### Translation Configuration

```bash
# Enable/disable translation
GOOGLE_TRANSLATE_API_KEY=your_api_key
GOOGLE_TRANSLATE_API_URL=https://translation.googleapis.com/language/translate/v2
```

**Service**: `internal/services/translator.go`

---

## Image URL Construction

### Problem: Missing Image URLs

The B2B API returns image data with **UUIDs** but often with **empty URL fields**:

```xml
<imageList>
  <image>
    <UUID>550e8400-e29b-41d4-a716-446655440000</UUID>
    <name>Front view</name>
    <pathGlobal></pathGlobal>  <!-- EMPTY -->
    <path></path>              <!-- EMPTY -->
  </image>
</imageList>
```

### Solution: Construct CDN URLs from UUIDs

We construct image URLs using the IT-Ultra CDN pattern:

```
https://cdn-ultra.esempla.com/storage/{UUID}.png
```

### Image Extraction Priority

We try **4 approaches** in order to extract image UUIDs:

```go
// APPROACH 1: Extract UUIDs from ImageList (PRIMARY)
for _, img := range b2bProduct.ImageList {
    if img.UUID != "" && img.UUID != "00000000-0000-0000-0000-000000000000" {
        imageURLs = append(imageURLs,
            fmt.Sprintf("https://cdn-ultra.esempla.com/storage/%s.png", img.UUID))
    }
}

// APPROACH 2: Fallback to imageIds array
if len(imageURLs) == 0 && len(b2bProduct.ImageIds) > 0 {
    for _, imageID := range b2bProduct.ImageIds {
        imageURLs = append(imageURLs,
            fmt.Sprintf("https://cdn-ultra.esempla.com/storage/%s.png", imageID))
    }
}

// APPROACH 3: Use mainImage UUID
if len(imageURLs) == 0 && b2bProduct.MainImage != "" {
    imageURLs = append(imageURLs,
        fmt.Sprintf("https://cdn-ultra.esempla.com/storage/%s.png", b2bProduct.MainImage))
}

// APPROACH 4: Use pre-constructed URLs (rare)
if len(imageURLs) == 0 {
    for _, img := range b2bProduct.ImageList {
        if img.PathGlobal != "" {
            imageURLs = append(imageURLs, img.PathGlobal)
        }
    }
}
```

**File**: `internal/sync/sources/ultra.go:751-787`

### Image Storage for ProductUltra

For the `products_ultra` table, images are stored as JSONB with full metadata:

```go
imageObjects := []map[string]string{
    {
        "UUID":        "550e8400-...",
        "description": "Front view",
        "fileGlobal":  "https://cdn-ultra.esempla.com/storage/550e8400-....png",
        "fileInterna": "",
    },
}

imagesJSON := models.JSONB{"images": imageObjects}
product.Images = imagesJSON
```

**File**: `internal/sync/sources/ultra.go:915-977`

---

## Database Storage

### Source-Specific Tables

Ultra data is stored in dedicated tables to preserve data provenance:

#### brands_ultra
```sql
CREATE TABLE brands_ultra (
    id UUID PRIMARY KEY,
    external_id TEXT UNIQUE NOT NULL,  -- Brand UUID from API
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    source_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

#### categories_ultra
```sql
CREATE TABLE categories_ultra (
    id UUID PRIMARY KEY,
    external_id TEXT UNIQUE NOT NULL,  -- Category UUID from API
    parent_id UUID REFERENCES categories_ultra(id),
    name TEXT NOT NULL,                -- Translated to Romanian
    slug TEXT UNIQUE NOT NULL,
    path LTREE,                        -- Hierarchical path
    position INT DEFAULT 0,
    active BOOLEAN DEFAULT true,       -- From API active field
    source_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

#### products_ultra
```sql
CREATE TABLE products_ultra (
    id UUID PRIMARY KEY,
    external_id TEXT UNIQUE NOT NULL,  -- Product UUID from API
    name TEXT NOT NULL,                -- Translated to Romanian
    code TEXT,
    article TEXT,
    slug TEXT NOT NULL,                -- Generated from translated name
    parent_id TEXT,                    -- Parent product UUID
    brand_id UUID REFERENCES brands_ultra(id),
    brand_external_id TEXT,            -- Brand UUID from API
    category_id UUID REFERENCES categories_ultra(id),
    category_external_id TEXT,         -- Category UUID from API
    active BOOLEAN DEFAULT true,
    service BOOLEAN DEFAULT false,
    warranty TEXT DEFAULT '',
    object TEXT,

    -- JSONB fields for rich data
    prices JSONB DEFAULT '[]',         -- Multi-currency prices
    images JSONB DEFAULT '[]',         -- Image metadata
    stock JSONB DEFAULT '[]',          -- Stock balances
    characteristics JSONB DEFAULT '[]', -- Product variants
    properties JSONB DEFAULT '[]',     -- Product properties
    barcodes JSONB DEFAULT '[]',       -- Barcode list

    source_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

**Migration**: `migrations/034_create_products_ultra.up.sql`

---

### JSONB Field Examples

#### Prices JSONB
```json
{
  "prices": [
    {
      "UUID": "product-uuid",
      "Characteristic": "",
      "Price": 1299.99,
      "PriceType": {
        "UUID": "price-type-uuid",
        "name": "Retail",
        "currency": {
          "UUID": "currency-uuid",
          "name": "USD",
          "code": "USD"
        }
      }
    }
  ]
}
```

#### Images JSONB
```json
{
  "images": [
    {
      "UUID": "550e8400-e29b-41d4-a716-446655440000",
      "description": "Front view",
      "fileGlobal": "https://cdn-ultra.esempla.com/storage/550e8400-e29b-41d4-a716-446655440000.png",
      "fileInterna": ""
    }
  ]
}
```

#### Stock JSONB
```json
{
  "stock": [
    {
      "UUID": "product-uuid",
      "name": "Main Warehouse",
      "code": "WH-01",
      "Characteristic": "",
      "quantity": 50,
      "quantityShowroom": 5
    }
  ]
}
```

#### Characteristics JSONB
```json
{
  "characteristics": [
    {
      "UUID": "char-uuid",
      "name": "Black 256GB",
      "code": "BLACK-256",
      "reference": "parent-uuid",
      "valueList": [
        {
          "property": {
            "UUID": "prop-uuid",
            "name": "Color",
            "code": "COLOR"
          },
          "value": {
            "type": "string",
            "simpleValue": "Black"
          }
        }
      ]
    }
  ]
}
```

---

## Complete Sync Flow

### High-Level Overview

```
1. Connect to B2B API → Test connection
2. Fetch NOMENCLATURE   → Parse products (xml2js service)
3. Fetch PRICELIST      → Parse prices (Go XML parser)
4. Fetch BALANCE        → Parse stock (Go XML parser)
5. Translate Products   → Batch translate to Romanian
6. Merge Data           → Combine products + prices + stock
7. Store in Database    → Insert/update products_ultra table
```

### Detailed Flow

```go
// 1. Fetch NOMENCLATURE (products)
nomenclatureXML, _ := b2bClient.FetchDataAsync(ctx, RequestTypeProducts)
parsedData, _ := parseXMLWithService(ctx, nomenclatureXML)
nomenclatures := extractProducts(parsedData)  // ~5000-10000 products

// 2. Fetch PRICELIST
priceListXML, _ := b2bClient.FetchDataAsync(ctx, RequestTypePrices)
prices := parseXML(priceListXML)  // ~10000-20000 price entries
priceMap := indexByProductAndVariant(prices)

// 3. Fetch BALANCE (stock)
balanceXML, _ := b2bClient.FetchDataAsync(ctx, RequestTypeStock)
stock := parseXML(balanceXML)  // ~5000-10000 stock entries
stockMap := indexByProduct(stock)

// 4. Batch translate product names
productNames := extractNames(nomenclatures)
translatedNames := translator.TranslateBatch(ctx, productNames, "en", "ro")

// 5. Merge data
for i, product := range nomenclatures {
    product.Name = translatedNames[i]
    product.Prices = priceMap[product.UUID]
    product.Stock = stockMap[product.UUID]
}

// 6. Build ProductUltra models with JSONB fields
productsUltra := buildProductsUltra(nomenclatures, priceMap, stockMap, translatedNames)

// 7. Store in database
repo.BatchCreateOrUpdate(productsUltra)
```

**File**: `internal/sync/sources/ultra.go:429-858`

---

## Performance Considerations

### Current Performance

| Operation | Time | Count |
|-----------|------|-------|
| Fetch NOMENCLATURE | ~30-60s | 5000-10000 products |
| Fetch PRICELIST | ~10-20s | 10000-20000 prices |
| Fetch BALANCE | ~10-20s | 5000-10000 stock entries |
| Batch Translation | ~30-60s | 5000-10000 texts |
| Total Sync Time | **~2-3 minutes** | Full catalog |

### Optimizations

1. **PROPERTIES Skipped**: Saves ~30 minutes (354 groups × 5s = 1770s)
2. **Batch Translation**: Uses Google's batch API (128 texts/request)
3. **Indexed Lookups**: Prices and stock indexed by UUID for O(1) lookups
4. **Node.js Parser**: Offloads complex XML parsing to specialized service
5. **Connection Pooling**: HTTP client reuses connections

### Rate Limiting

The API configuration includes rate limiting to avoid overwhelming the server:

```go
RequestInterval: 1s  // Wait 1 second between requests
MaxRetries: 3        // Retry failed requests up to 3 times
```

---

## Error Handling

### SOAP Fault Detection

All SOAP responses are checked for faults before parsing:

```go
var genericEnv struct {
    Body struct {
        Fault *SOAPFault
    }
}
xml.Unmarshal(respBody, &genericEnv)

if genericEnv.Body.Fault != nil {
    return fmt.Errorf("SOAP fault: %s - %s",
        genericEnv.Body.Fault.Code,
        genericEnv.Body.Fault.String)
}
```

### Retry Logic

Failed requests are automatically retried with exponential backoff:

```go
for attempt := 0; attempt <= maxRetries; attempt++ {
    if attempt > 0 {
        time.Sleep(requestInterval * time.Duration(attempt))
    }

    err := executeSoapCall(ctx, request, response)
    if err == nil {
        return nil
    }
}
```

### Graceful Degradation

If optional services fail, the sync continues:

```go
// If prices fetch fails, continue without prices
priceListData, err := b2bClient.FetchDataAsync(ctx, RequestTypePrices)
if err != nil {
    logger.Warn("Failed to fetch PRICELIST - continuing without prices", "error", err)
    // priceMap remains empty, products will have no prices
}
```

---

## Testing & Debugging

### Test Connection

```bash
# Test B2B API connection
curl -X POST https://portal.it-ultra.com/b2b/ws/b2b.1cws \
  -u username:password \
  -H "Content-Type: text/xml" \
  -d '<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns1:testService xmlns:ns1="http://ultra.b2b.md"/>
  </soap:Body>
</soap:Envelope>'
```

### Manual Sync

```bash
# Trigger Ultra sync via admin API
curl -X POST http://localhost:8080/api/admin/sync/ultra \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Debug Logging

Enable debug logging to see detailed API communication:

```go
logger.SetLevel("debug")
```

This will log:
- SOAP request/response XML
- XML parsing steps
- Translation progress
- Data indexing statistics

---

## References

### API Documentation
- **WSDL Endpoint**: https://portal.it-ultra.com/b2b/ws/b2b.1cws?wsdl
- **CDN Base URL**: https://cdn-ultra.esempla.com/storage/

### Related Files
- **B2B Client**: `internal/b2b/client.go`
- **B2B Types**: `internal/b2b/types.go`
- **Ultra Source**: `internal/sync/sources/ultra.go`
- **Translator Service**: `internal/services/translator.go`
- **Database Models**: `internal/models/source_entities.go`
- **Migrations**: `migrations/034_create_products_ultra.up.sql`

### Database Schema
See `DATABASE.md` for complete schema documentation of:
- `brands_ultra`
- `categories_ultra`
- `products_ultra`
- Multi-source architecture

---

## Troubleshooting

### XML Parsing Errors

**Symptom**: `failed to parse XML: invalid character entity`

**Cause**: Malformed XML with unescaped ampersands or invalid tag names

**Solution**: Ensure `fixMalformedXMLEntities()` is called before parsing OR use the xml2js microservice

---

### Empty Images

**Symptom**: Products have no images despite API returning image UUIDs

**Cause**: `pathGlobal` field is empty in API response

**Solution**: Images are constructed from UUIDs using the CDN pattern. Check that UUIDs are not `00000000-0000-0000-0000-000000000000`.

---

### Translation Failures

**Symptom**: Product names remain in English

**Cause**: Google Translation API key not configured or API quota exceeded

**Solution**:
1. Check `GOOGLE_TRANSLATE_API_KEY` is set
2. Verify API quota in Google Cloud Console
3. Check service logs for translation errors

---

### Slow Sync

**Symptom**: Sync takes 30+ minutes

**Cause**: PROPERTIES service is being fetched (skipped by default)

**Solution**: Ensure PROPERTIES fetching code is commented out (lines 570-616 in `ultra.go`)

---

## Future Improvements

1. **Incremental Sync**: Use `lastSync` parameter to fetch only changed data
2. **Parallel Fetching**: Fetch NOMENCLATURE, PRICELIST, BALANCE concurrently
3. **Redis Caching**: Cache translated names to avoid re-translation
4. **Webhook Support**: Real-time updates from IT-Ultra when products change
5. **Image Validation**: Verify CDN URLs return 200 before storing
6. **Compression**: Enable `compress=true` in requestData for faster downloads

---

## Conclusion

The IT-Ultra B2B API integration provides comprehensive product catalog data through a SOAP-based asynchronous workflow. Key challenges like malformed XML and missing image URLs are solved through custom parsing and CDN URL construction. Batch translation and efficient indexing ensure the sync completes in 2-3 minutes for the full catalog.
