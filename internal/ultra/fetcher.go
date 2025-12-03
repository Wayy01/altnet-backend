package ultra

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"

	"ultra-api-testing/internal/models"
)

// isActiveFromString converts API boolean string to bool, defaulting to true.
// Handles common falsy values case-insensitively: "false", "0", "no", "n"
func isActiveFromString(value string) bool {
	v := strings.ToLower(strings.TrimSpace(value))
	return v != "false" && v != "0" && v != "no" && v != "n"
}

// regionCodePattern matches common region codes at the end of product names
// Patterns: " MD", " EU", " EU/RU", " DE", " RU", " UA", etc.
var regionCodePattern = regexp.MustCompile(`\s+(MD|EU|DE|RU|UA|EU/RU|RO|PL|CZ|HU|SK|BG|HR|SI|RS|BA|MK|AL|XK|ME|AT|CH|IT|FR|ES|PT|GB|UK|US|CN|JP|KR|TW|HK|SG|AU|NZ|CA|MX|BR|AR|CL|CO|PE|VE|ZA|EG|AE|SA|IL|TR|IN|ID|MY|TH|PH|VN)\s*$`)

// cleanProductName removes region codes from the end of product names
// Example: "iPhone 16 Pro Max, 256GB Black Titanium MD" -> "iPhone 16 Pro Max, 256GB Black Titanium"
func cleanProductName(name string) string {
	return strings.TrimSpace(regionCodePattern.ReplaceAllString(name, ""))
}

// Fetcher handles fetching and parsing data from Ultra API
type Fetcher struct {
	client *Client
}

// NewFetcher creates a new fetcher
func NewFetcher(client *Client) *Fetcher {
	return &Fetcher{
		client: client,
	}
}

// ============================================================================
// BRANDS
// ============================================================================

type BrandListXML struct {
	Brands []BrandXML `xml:"brand"`
}

type BrandXML struct {
	UUID   string `xml:"UUID"`
	Name   string `xml:"name"`
	Code   string `xml:"code"`
	Active string `xml:"active"`
	Image  struct {
		UUID       string `xml:"UUID"`
		Name       string `xml:"name"`
		PathGlobal string `xml:"pathGlobal"`
		Path       string `xml:"path"`
	} `xml:"image"`
}

func (f *Fetcher) FetchBrands(ctx context.Context, all bool) ([]*models.BrandInput, error) {
	log.Println("Fetching BRAND service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeBrands, all, "")
	if err != nil {
		return nil, fmt.Errorf("fetch brands: %w", err)
	}

	var brandList BrandListXML
	if err := ParseXML(xmlData, &brandList); err != nil {
		return nil, fmt.Errorf("parse brands XML: %w", err)
	}

	brands := make([]*models.BrandInput, 0, len(brandList.Brands))
	for _, b := range brandList.Brands {
		logoURL := ""
		if b.Image.UUID != "" && b.Image.UUID != "00000000-0000-0000-0000-000000000000" {
			logoURL = fmt.Sprintf("https://cdn-ultra.esempla.com/storage/%s.png", b.Image.UUID)
		} else if b.Image.PathGlobal != "" {
			logoURL = b.Image.PathGlobal
		}

		var logoURLPtr *string
		if logoURL != "" {
			logoURLPtr = &logoURL
		}

		var codePtr *string
		if b.Code != "" {
			codePtr = &b.Code
		}

		brand := &models.BrandInput{
			UltraID:  b.UUID,
			Code:     codePtr,
			Name:     b.Name,
			LogoURL:  logoURLPtr,
			IsActive: isActiveFromString(b.Active),
		}

		brands = append(brands, brand)
	}

	log.Printf("Fetched %d brands\n", len(brands))
	return brands, nil
}

// ============================================================================
// CATEGORIES
// ============================================================================

type CategoryListXML struct {
	Categories []CategoryXML `xml:"nomenclatureType"`
}

type CategoryXML struct {
	UUID     string `xml:"UUID"`
	Name     string `xml:"name"`
	Code     string `xml:"code"`
	Parent   string `xml:"parent"`
	OrderBy  string `xml:"orderBy"`
	Active   string `xml:"active"`
	Quantity string `xml:"quantity"`
	Image    struct {
		UUID       string `xml:"UUID"`
		PathGlobal string `xml:"pathGlobal"`
	} `xml:"image"`
}

func (f *Fetcher) FetchCategories(ctx context.Context, all bool) ([]*models.CategoryInput, error) {
	log.Println("Fetching NOMENCLATURETYPELIST service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeCategories, all, "")
	if err != nil {
		return nil, fmt.Errorf("fetch categories: %w", err)
	}

	var catList CategoryListXML
	if err := ParseXML(xmlData, &catList); err != nil {
		return nil, fmt.Errorf("parse categories XML: %w", err)
	}

	categories := make([]*models.CategoryInput, 0, len(catList.Categories))
	for _, c := range catList.Categories {
		orderBy, _ := strconv.Atoi(c.OrderBy)
		quantity, _ := strconv.Atoi(c.Quantity)

		var parentUltraID *string
		if c.Parent != "" && c.Parent != "00000000-0000-0000-0000-000000000000" {
			parentUltraID = &c.Parent
		}

		var codePtr *string
		if c.Code != "" {
			codePtr = &c.Code
		}

		var imageURL *string
		if c.Image.UUID != "" && c.Image.UUID != "00000000-0000-0000-0000-000000000000" {
			url := fmt.Sprintf("https://cdn-ultra.esempla.com/storage/%s.png", c.Image.UUID)
			imageURL = &url
		} else if c.Image.PathGlobal != "" {
			imageURL = &c.Image.PathGlobal
		}

		category := &models.CategoryInput{
			UltraID:       c.UUID,
			Code:          codePtr,
			ParentUltraID: parentUltraID,
			Name:          c.Name,
			SortOrder:     orderBy,
			ImageURL:      imageURL,
			ProductCount:  quantity,
			IsActive:      isActiveFromString(c.Active),
		}

		categories = append(categories, category)
	}

	log.Printf("Fetched %d categories\n", len(categories))
	return categories, nil
}

// ============================================================================
// PRODUCTS (NOMENCLATURE)
// ============================================================================

type ProductListXML struct {
	Products []ProductXML `xml:"nomenclature"`
}

type ProductXML struct {
	UUID               string `xml:"UUID"`
	Name               string `xml:"name"`
	Code               string `xml:"code"`
	Article            string `xml:"article"`
	Parent             string `xml:"parent"`
	NomenclatureType   string `xml:"nomenclatureType"`
	Brand              string `xml:"brand"`
	Active             string `xml:"active"`
	Service            string `xml:"service"`
	Warranty           string `xml:"warranty"`
	MainImage          string `xml:"mainImage"`
	Object             string `xml:"object"`
	CharacteristicList []struct {
		UUID      string `xml:"UUID"`
		Name      string `xml:"name"`
		Code      string `xml:"code"`
		Reference string `xml:"reference"`
	} `xml:"characteristicList>characteristic"`
	ImageList []struct {
		UUID       string `xml:"UUID"`
		Name       string `xml:"name"`
		PathGlobal string `xml:"pathGlobal"`
		Path       string `xml:"path"`
	} `xml:"imageList>image"`
	BarcodeList []struct {
		Code string `xml:"code"`
		Type string `xml:"type"`
	} `xml:"barcodeList>barcode"`
}

func (f *Fetcher) FetchProducts(ctx context.Context, all bool) ([]*models.ProductInput, map[string]interface{}, error) {
	log.Println("Fetching NOMENCLATURE service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeProducts, all, "")
	if err != nil {
		return nil, nil, fmt.Errorf("fetch products: %w", err)
	}

	var prodList ProductListXML
	if err := ParseXML(xmlData, &prodList); err != nil {
		return nil, nil, fmt.Errorf("parse products XML: %w", err)
	}

	products := make([]*models.ProductInput, 0, len(prodList.Products))

	for _, p := range prodList.Products {
		// Build images
		images := make([]map[string]string, 0)
		var mainImageURL *string
		for _, img := range p.ImageList {
			if img.UUID != "" && img.UUID != "00000000-0000-0000-0000-000000000000" {
				imageURL := fmt.Sprintf("https://cdn-ultra.esempla.com/storage/%s.png", img.UUID)
				images = append(images, map[string]string{
					"uuid":        img.UUID,
					"url":         imageURL,
					"description": img.Name,
					"path_global": img.PathGlobal,
				})
				if mainImageURL == nil {
					mainImageURL = &imageURL
				}
			}
		}

		// Build barcodes
		barcodes := make([]map[string]string, 0)
		for _, barcode := range p.BarcodeList {
			barcodes = append(barcodes, map[string]string{
				"code": barcode.Code,
				"type": barcode.Type,
			})
		}

		var brandUltraID, catUltraID, parentUltraID *string
		if p.Brand != "" && p.Brand != "00000000-0000-0000-0000-000000000000" {
			brandUltraID = &p.Brand
		}
		if p.NomenclatureType != "" && p.NomenclatureType != "00000000-0000-0000-0000-000000000000" {
			catUltraID = &p.NomenclatureType
		}
		if p.Parent != "" && p.Parent != "00000000-0000-0000-0000-000000000000" {
			parentUltraID = &p.Parent
		}

		var codePtr, articlePtr, warrantyPtr *string
		if p.Code != "" {
			codePtr = &p.Code
		}
		if p.Article != "" {
			articlePtr = &p.Article
		}
		if p.Warranty != "" {
			warrantyPtr = &p.Warranty
		}

		product := &models.ProductInput{
			UltraID:         p.UUID,
			Code:            codePtr,
			Article:         articlePtr,
			Name:            cleanProductName(p.Name), // Strip region codes (MD, EU, etc.)
			Description:     articlePtr,               // Using article as description
			BrandUltraID:    brandUltraID,
			CategoryUltraID: catUltraID,
			ParentUltraID:   parentUltraID,
			MainImageURL:    mainImageURL,
			Images:          images,
			Warranty:        warrantyPtr,
			Barcodes:        barcodes,
			IsActive:        isActiveFromString(p.Active),
			IsService:       p.Service == "true" || p.Service == "1",
		}

		products = append(products, product)
	}

	log.Printf("Fetched %d products\n", len(products))
	return products, nil, nil
}

// ============================================================================
// PRICES
// ============================================================================

type PriceListXML struct {
	Prices []PriceXML `xml:"price"`
}

type PriceXML struct {
	UUID           string `xml:"UUID"`
	Characteristic string `xml:"Characteristic"`
	Price          string `xml:"Price"`
	PriceType      struct {
		UUID     string `xml:"UUID"`
		Name     string `xml:"name"`
		Currency struct {
			UUID string `xml:"UUID"`
			Name string `xml:"name"`
			Code string `xml:"code"`
		} `xml:"currency"`
	} `xml:"PriceType"`
}

func (f *Fetcher) FetchPrices(ctx context.Context, all bool) ([]*models.PriceInput, error) {
	log.Println("Fetching PRICELIST service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypePrices, all, "")
	if err != nil {
		return nil, fmt.Errorf("fetch prices: %w", err)
	}

	var priceList PriceListXML
	if err := ParseXML(xmlData, &priceList); err != nil {
		return nil, fmt.Errorf("parse prices XML: %w", err)
	}

	prices := make([]*models.PriceInput, 0, len(priceList.Prices))
	for _, p := range priceList.Prices {
		price, _ := strconv.ParseFloat(p.Price, 64)

		priceInput := &models.PriceInput{
			ProductUltraID: p.UUID,
			Price:          price,
			Currency:       p.PriceType.Currency.Code,
			PriceType:      p.PriceType.Name,
			PriceTypeUUID:  p.PriceType.UUID,
		}

		prices = append(prices, priceInput)
	}

	log.Printf("Fetched %d prices\n", len(prices))
	return prices, nil
}

// ============================================================================
// STOCK
// ============================================================================

type BalanceListXML struct {
	Balances []BalanceXML `xml:"balance"`
}

type BalanceXML struct {
	UUID             string `xml:"UUID"`
	Name             string `xml:"name"`
	Code             string `xml:"code"`
	Characteristic   string `xml:"Characteristic"`
	Quantity         string `xml:"quantity"`
	QuantityShowroom string `xml:"quantityShowroom"`
}

func (f *Fetcher) FetchStock(ctx context.Context, all bool) ([]*models.StockInput, error) {
	log.Println("Fetching BALANCE service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeStock, all, "")
	if err != nil {
		return nil, fmt.Errorf("fetch stock: %w", err)
	}

	var balanceList BalanceListXML
	if err := ParseXML(xmlData, &balanceList); err != nil {
		return nil, fmt.Errorf("parse stock XML: %w", err)
	}

	stocks := make([]*models.StockInput, 0, len(balanceList.Balances))
	for _, b := range balanceList.Balances {
		qty, _ := strconv.ParseFloat(b.Quantity, 64)
		qtyShowroom, _ := strconv.ParseFloat(b.QuantityShowroom, 64)

		stockInput := &models.StockInput{
			ProductUltraID: b.UUID,
			Warehouse:      int(qty),
			Showroom:       int(qtyShowroom),
		}

		stocks = append(stocks, stockInput)
	}

	log.Printf("Fetched stock for %d products\n", len(stocks))
	return stocks, nil
}

// ============================================================================
// EXCHANGE RATES
// ============================================================================

type RateListXML struct {
	Rates []RateXML `xml:"rate"`
}

type RateXML struct {
	Rate   string `xml:"rate"`
	Valute struct {
		UUID string `xml:"UUID"`
		Name string `xml:"name"`
		Code string `xml:"code"`
	} `xml:"valute"`
}

func (f *Fetcher) FetchRates(ctx context.Context) ([]*models.ExchangeRate, error) {
	log.Println("Fetching RATES service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeRates, true, "")
	if err != nil {
		return nil, fmt.Errorf("fetch rates: %w", err)
	}

	var rateList RateListXML
	if err := ParseXML(xmlData, &rateList); err != nil {
		return nil, fmt.Errorf("parse rates XML: %w", err)
	}

	rates := make([]*models.ExchangeRate, 0, len(rateList.Rates))
	for _, r := range rateList.Rates {
		rate, _ := strconv.ParseFloat(r.Rate, 64)

		rateObj := &models.ExchangeRate{
			CurrencyUUID: r.Valute.UUID,
			CurrencyCode: r.Valute.Code,
			CurrencyName: r.Valute.Name,
			Rate:         rate,
		}

		rates = append(rates, rateObj)
	}

	log.Printf("Fetched %d exchange rates\n", len(rates))
	return rates, nil
}

// ============================================================================
// PROPERTIES (Per Category)
// ============================================================================

type PropertiesListXML struct {
	Nomenclatures []PropertyNomenclatureXML `xml:"nomenclature"`
}

type PropertyNomenclatureXML struct {
	UUID         string             `xml:"UUID"`
	PropertyList []PropertyValueXML `xml:"propertyList>propertyValue"`
}

type PropertyValueXML struct {
	Property struct {
		Name string `xml:"name"`
		UUID string `xml:"UUID"`
		Code string `xml:"code"`
	} `xml:"property"`
	Value struct {
		Name        string `xml:"name"`
		UUID        string `xml:"UUID"`
		Type        string `xml:"type"`
		SimpleValue string `xml:"simpleValue"`
	} `xml:"value"`
	PropertyGroup struct {
		Name string `xml:"name"`
		UUID string `xml:"UUID"`
		Code string `xml:"code"`
	} `xml:"propertyGroup"`
	Filter       string `xml:"filter"`
	Modification string `xml:"modification"`
	OrderBy      string `xml:"orderBy"`
}

// FetchPropertiesForCategory fetches properties for all products in a specific category
func (f *Fetcher) FetchPropertiesForCategory(ctx context.Context, categoryUUID string) (map[string][]*models.PropertyInput, error) {
	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeProperties, false, categoryUUID)
	if err != nil {
		return nil, fmt.Errorf("fetch properties for category %s: %w", categoryUUID, err)
	}

	var propList PropertiesListXML
	if err := ParseXML(xmlData, &propList); err != nil {
		return nil, fmt.Errorf("parse properties XML: %w", err)
	}

	// Build map of product UUID => properties
	productProperties := make(map[string][]*models.PropertyInput)

	for _, nom := range propList.Nomenclatures {
		if len(nom.PropertyList) == 0 {
			continue
		}

		props := make([]*models.PropertyInput, 0, len(nom.PropertyList))
		for _, prop := range nom.PropertyList {
			// Use SimpleValue if available, otherwise use Name (for reference values)
			value := prop.Value.SimpleValue
			if value == "" && prop.Value.Name != "" {
				value = prop.Value.Name
			}

			var propUUID, propCode, valueType, groupUUID, groupName *string
			if prop.Property.UUID != "" {
				propUUID = &prop.Property.UUID
			}
			if prop.Property.Code != "" {
				propCode = &prop.Property.Code
			}
			if prop.Value.Type != "" {
				valueType = &prop.Value.Type
			}
			if prop.PropertyGroup.UUID != "" {
				groupUUID = &prop.PropertyGroup.UUID
			}
			if prop.PropertyGroup.Name != "" {
				groupName = &prop.PropertyGroup.Name
			}

			var valuePtr *string
			if value != "" {
				valuePtr = &value
			}

			orderBy, _ := strconv.Atoi(prop.OrderBy)

			propInput := &models.PropertyInput{
				ProductUltraID: nom.UUID,
				PropertyUUID:   propUUID,
				PropertyName:   prop.Property.Name,
				PropertyCode:   propCode,
				Value:          valuePtr,
				ValueType:      valueType,
				GroupUUID:      groupUUID,
				GroupName:      groupName,
				SortOrder:      orderBy,
				IsFilter:       prop.Filter == "true" || prop.Filter == "1",
				IsModification: prop.Modification == "true" || prop.Modification == "1",
			}

			props = append(props, propInput)
		}

		productProperties[nom.UUID] = props
	}

	return productProperties, nil
}
