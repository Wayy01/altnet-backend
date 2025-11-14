package ultra

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
)

// Fetcher handles fetching and parsing data from Ultra API
type Fetcher struct {
	client *Client
	sourceID uuid.UUID
}

// NewFetcher creates a new fetcher
func NewFetcher(client *Client, sourceID uuid.UUID) *Fetcher {
	return &Fetcher{
		client:   client,
		sourceID: sourceID,
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

func (f *Fetcher) FetchBrands(ctx context.Context, all bool) ([]*models.BrandSource, error) {
	log.Println("Fetching BRAND service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeBrands, all, "")
	if err != nil {
		return nil, fmt.Errorf("fetch brands: %w", err)
	}

	var brandList BrandListXML
	if err := ParseXML(xmlData, &brandList); err != nil {
		return nil, fmt.Errorf("parse brands XML: %w", err)
	}

	brands := make([]*models.BrandSource, 0, len(brandList.Brands))
	for _, b := range brandList.Brands {
		// Convert to JSONB
		sourceData := make(models.JSONB)
		data, _ := json.Marshal(b)
		json.Unmarshal(data, &sourceData)

		logoURL := ""
		if b.Image.UUID != "" && b.Image.UUID != "00000000-0000-0000-0000-000000000000" {
			logoURL = fmt.Sprintf("https://cdn-ultra.esempla.com/storage/%s.png", b.Image.UUID)
		} else if b.Image.PathGlobal != "" {
			logoURL = b.Image.PathGlobal
		}

		logoURLPtr := &logoURL
		codePtr := &b.Code

		brand := &models.BrandSource{
			SourceID:   f.sourceID,
			ExternalID: b.UUID,
			SourceData: sourceData,
			Name:       b.Name,
			Code:       codePtr,
			LogoURL:    logoURLPtr,
			IsActive:   b.Active == "true" || b.Active == "1",
		}

		brands = append(brands, brand)
	}

	log.Printf("✓ Fetched %d brands\n", len(brands))
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
	PropertyList []struct {
		Property struct {
			UUID string `xml:"UUID"`
			Name string `xml:"name"`
			Code string `xml:"code"`
		} `xml:"property"`
		Value struct {
			Type        string `xml:"type"`
			SimpleValue string `xml:"simpleValue"`
		} `xml:"value"`
	} `xml:"propertyList>propertyValue"`
}

func (f *Fetcher) FetchCategories(ctx context.Context, all bool) ([]*models.CategorySource, error) {
	log.Println("Fetching NOMENCLATURETYPELIST service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeCategories, all, "")
	if err != nil {
		return nil, fmt.Errorf("fetch categories: %w", err)
	}

	var catList CategoryListXML
	if err := ParseXML(xmlData, &catList); err != nil {
		return nil, fmt.Errorf("parse categories XML: %w", err)
	}

	categories := make([]*models.CategorySource, 0, len(catList.Categories))
	for _, c := range catList.Categories {
		// Convert to JSONB
		sourceData := make(models.JSONB)
		data, _ := json.Marshal(c)
		json.Unmarshal(data, &sourceData)

		orderBy, _ := strconv.Atoi(c.OrderBy)
		quantity, _ := strconv.Atoi(c.Quantity)

		var parentExternalID *string
		if c.Parent != "" && c.Parent != "00000000-0000-0000-0000-000000000000" {
			parentExternalID = &c.Parent
		}

		codePtr := &c.Code

		category := &models.CategorySource{
			SourceID:         f.sourceID,
			ExternalID:       c.UUID,
			ParentExternalID: parentExternalID,
			SourceData:       sourceData,
			Name:             c.Name,
			Code:             codePtr,
			SortOrder:        orderBy,
			IsActive:         c.Active == "true" || c.Active == "1",
			ProductCount:     quantity,
		}

		categories = append(categories, category)
	}

	log.Printf("✓ Fetched %d categories\n", len(categories))
	return categories, nil
}

// ============================================================================
// PRODUCTS (NOMENCLATURE)
// ============================================================================

type ProductListXML struct {
	Products []ProductXML `xml:"nomenclature"`
}

type ProductXML struct {
	UUID              string `xml:"UUID"`
	Name              string `xml:"name"`
	Code              string `xml:"code"`
	Article           string `xml:"article"`
	Parent            string `xml:"parent"`
	NomenclatureType  string `xml:"nomenclatureType"`
	Brand             string `xml:"brand"`
	Active            string `xml:"active"`
	Service           string `xml:"service"`
	Warranty          string `xml:"warranty"`
	MainImage         string `xml:"mainImage"`
	Object            string `xml:"object"`
	CharacteristicList []struct {
		UUID      string `xml:"UUID"`
		Name      string `xml:"name"`
		Code      string `xml:"code"`
		Reference string `xml:"reference"`
		ValueList []struct {
			Property struct {
				UUID string `xml:"UUID"`
				Name string `xml:"name"`
				Code string `xml:"code"`
			} `xml:"property"`
			Value struct {
				Type        string `xml:"type"`
				SimpleValue string `xml:"simpleValue"`
			} `xml:"value"`
		} `xml:"valueList>propertyCharacteristicValue"`
	} `xml:"characteristicList>characteristic"`
	PropertyList []struct {
		Property struct {
			UUID string `xml:"UUID"`
			Name string `xml:"name"`
			Code string `xml:"code"`
		} `xml:"property"`
		Value struct {
			Type        string `xml:"type"`
			SimpleValue string `xml:"simpleValue"`
		} `xml:"value"`
		Filter       string `xml:"filter"`
		Modification string `xml:"modification"`
		PropertyGroup struct {
			UUID string `xml:"UUID"`
			Name string `xml:"name"`
		} `xml:"propertyGroup"`
	} `xml:"propertyList>propertyValue"`
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

func (f *Fetcher) FetchProducts(ctx context.Context, all bool) ([]*models.ProductSource, error) {
	log.Println("Fetching NOMENCLATURE service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeProducts, all, "")
	if err != nil {
		return nil, fmt.Errorf("fetch products: %w", err)
	}

	var prodList ProductListXML
	if err := ParseXML(xmlData, &prodList); err != nil {
		return nil, fmt.Errorf("parse products XML: %w", err)
	}

	products := make([]*models.ProductSource, 0, len(prodList.Products))
	for _, p := range prodList.Products {
		// Convert to JSONB
		sourceData := make(models.JSONB)
		data, _ := json.Marshal(p)
		json.Unmarshal(data, &sourceData)

		// Build images JSONB
		images := make([]map[string]string, 0)
		for _, img := range p.ImageList {
			if img.UUID != "" && img.UUID != "00000000-0000-0000-0000-000000000000" {
				imageURL := fmt.Sprintf("https://cdn-ultra.esempla.com/storage/%s.png", img.UUID)
				images = append(images, map[string]string{
					"uuid":        img.UUID,
					"url":         imageURL,
					"description": img.Name,
					"path_global": img.PathGlobal,
				})
			}
		}

		// Build characteristics JSONB
		characteristics := make([]map[string]interface{}, 0)
		for _, char := range p.CharacteristicList {
			characteristics = append(characteristics, map[string]interface{}{
				"uuid":      char.UUID,
				"name":      char.Name,
				"code":      char.Code,
				"reference": char.Reference,
			})
		}

		// Build properties JSONB
		properties := make(map[string]interface{})
		for _, prop := range p.PropertyList {
			properties[prop.Property.Name] = prop.Value.SimpleValue
		}

		// Build barcodes JSONB
		barcodes := make([]map[string]string, 0)
		for _, barcode := range p.BarcodeList {
			barcodes = append(barcodes, map[string]string{
				"code": barcode.Code,
				"type": barcode.Type,
			})
		}

		var brandExtID, catExtID, parentExtID *string
		if p.Brand != "" && p.Brand != "00000000-0000-0000-0000-000000000000" {
			brandExtID = &p.Brand
		}
		if p.NomenclatureType != "" && p.NomenclatureType != "00000000-0000-0000-0000-000000000000" {
			catExtID = &p.NomenclatureType
		}
		if p.Parent != "" && p.Parent != "00000000-0000-0000-0000-000000000000" {
			parentExtID = &p.Parent
		}

		codePtr := &p.Code
		descPtr := &p.Article

		product := &models.ProductSource{
			SourceID:           f.sourceID,
			ExternalID:         p.UUID,
			BrandExternalID:    brandExtID,
			CategoryExternalID: catExtID,
			ParentExternalID:   parentExtID,
			SourceData:         sourceData,
			Name:               p.Name,
			Code:               codePtr,
			Description:        descPtr,
			IsActive:           p.Active == "true" || p.Active == "1",
			Images:             models.JSONB{"images": images},
			Characteristics:    models.JSONB{"characteristics": characteristics},
			Properties:         models.JSONB(properties),
			Barcodes:           models.JSONB{"barcodes": barcodes},
		}

		products = append(products, product)
	}

	log.Printf("✓ Fetched %d products\n", len(products))
	return products, nil
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

func (f *Fetcher) FetchPrices(ctx context.Context, all bool) (map[string][]map[string]interface{}, error) {
	log.Println("Fetching PRICELIST service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypePrices, all, "")
	if err != nil {
		return nil, fmt.Errorf("fetch prices: %w", err)
	}

	var priceList PriceListXML
	if err := ParseXML(xmlData, &priceList); err != nil {
		return nil, fmt.Errorf("parse prices XML: %w", err)
	}

	// Index prices by product external ID
	priceMap := make(map[string][]map[string]interface{})

	for _, p := range priceList.Prices {
		price, _ := strconv.ParseFloat(p.Price, 64)

		priceObj := map[string]interface{}{
			"price":    price,
			"currency": p.PriceType.Currency.Code,
			"type":     p.PriceType.Name,
		}

		if p.Characteristic != "" && p.Characteristic != "00000000-0000-0000-0000-000000000000" {
			priceObj["characteristic"] = p.Characteristic
		}

		priceMap[p.UUID] = append(priceMap[p.UUID], priceObj)
	}

	log.Printf("✓ Fetched prices for %d products\n", len(priceMap))
	return priceMap, nil
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

func (f *Fetcher) FetchStock(ctx context.Context, all bool) (map[string]map[string]interface{}, error) {
	log.Println("Fetching BALANCE service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeStock, all, "")
	if err != nil {
		return nil, fmt.Errorf("fetch stock: %w", err)
	}

	var balanceList BalanceListXML
	if err := ParseXML(xmlData, &balanceList); err != nil {
		return nil, fmt.Errorf("parse stock XML: %w", err)
	}

	// Index stock by product external ID
	stockMap := make(map[string]map[string]interface{})

	for _, b := range balanceList.Balances {
		qty, _ := strconv.ParseFloat(b.Quantity, 64)
		qtyShowroom, _ := strconv.ParseFloat(b.QuantityShowroom, 64)

		stockObj := map[string]interface{}{
			"warehouse": qty,
			"showroom":  qtyShowroom,
			"total":     qty + qtyShowroom,
		}

		if b.Characteristic != "" && b.Characteristic != "00000000-0000-0000-0000-000000000000" {
			stockObj["characteristic"] = b.Characteristic
		}

		stockMap[b.UUID] = stockObj
	}

	log.Printf("✓ Fetched stock for %d products\n", len(stockMap))
	return stockMap, nil
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

func (f *Fetcher) FetchRates(ctx context.Context) ([]map[string]interface{}, error) {
	log.Println("Fetching RATES service...")

	xmlData, err := f.client.FetchDataAsync(ctx, RequestTypeRates, true, "")
	if err != nil {
		return nil, fmt.Errorf("fetch rates: %w", err)
	}

	var rateList RateListXML
	if err := ParseXML(xmlData, &rateList); err != nil {
		return nil, fmt.Errorf("parse rates XML: %w", err)
	}

	rates := make([]map[string]interface{}, 0)
	for _, r := range rateList.Rates {
		rate, _ := strconv.ParseFloat(r.Rate, 64)

		rateObj := map[string]interface{}{
			"rate":          rate,
			"currency_uuid": r.Valute.UUID,
			"currency_code": r.Valute.Code,
			"currency_name": r.Valute.Name,
		}

		rates = append(rates, rateObj)
	}

	log.Printf("✓ Fetched %d exchange rates\n", len(rates))
	return rates, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

func getBool(value string) bool {
	return strings.ToLower(value) == "true" || value == "1"
}

func getStringPtr(value string) *string {
	if value == "" || value == "00000000-0000-0000-0000-000000000000" {
		return nil
	}
	return &value
}
