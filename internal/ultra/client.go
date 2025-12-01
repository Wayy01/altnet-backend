package ultra

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"net/http"
	"time"

	"ultra-api-testing/internal/config"
)

// RequestType represents different Ultra API services
type RequestType string

const (
	RequestTypeProducts    RequestType = "NOMENCLATURE"
	RequestTypeBrands      RequestType = "BRAND"
	RequestTypeCategories  RequestType = "NOMENCLATURETYPELIST"
	RequestTypePrices      RequestType = "PRICELIST"
	RequestTypeStock       RequestType = "BALANCE"
	RequestTypeProperties  RequestType = "PROPERTIES"
	RequestTypeRates       RequestType = "RATES"
	RequestTypeParentList  RequestType = "PARENTLIST"
	RequestTypeOrderStatus RequestType = "ORDERSSTAT"
)

// Client represents Ultra B2B API client
type Client struct {
	config     config.UltraConfig
	httpClient *http.Client
}

// NewClient creates a new Ultra API client
func NewClient(cfg config.UltraConfig) *Client {
	return &Client{
		config:     cfg,
		httpClient: &http.Client{
			// No timeout - allow requests to run indefinitely
		},
	}
}

// SOAP Envelope structures
type SOAPEnvelope struct {
	XMLName xml.Name `xml:"http://schemas.xmlsoap.org/soap/envelope/ Envelope"`
	Body    SOAPBody
}

type SOAPBody struct {
	XMLName xml.Name `xml:"http://schemas.xmlsoap.org/soap/envelope/ Body"`
	Content interface{}
}

type SOAPFault struct {
	Code   string `xml:"faultcode"`
	String string `xml:"faultstring"`
}

// requestData structures
type RequestDataRequest struct {
	XMLName              xml.Name `xml:"http://ultra.b2b.md requestData"`
	Service              string   `xml:"Service"`
	All                  bool     `xml:"all"`
	AdditionalParameters string   `xml:"additionalParameters"`
	Compress             bool     `xml:"compress"`
}

type RequestDataResponse struct {
	XMLName xml.Name `xml:"requestDataResponse"`
	Return  string   `xml:"http://ultra.b2b.md return"`
}

// isReady structures
type IsReadyRequest struct {
	XMLName xml.Name `xml:"http://ultra.b2b.md isReady"`
	ID      string   `xml:"ID"`
}

type IsReadyResponse struct {
	XMLName xml.Name `xml:"isReadyResponse"`
	Return  bool     `xml:"http://ultra.b2b.md return"`
}

// getDataByID structures
type GetDataByIDRequest struct {
	XMLName xml.Name `xml:"http://ultra.b2b.md getDataByID"`
	ID      string   `xml:"ID"`
}

type GetDataByIDResponse struct {
	XMLName xml.Name `xml:"getDataByIDResponse"`
	Return  struct {
		Message string `xml:"http://ultra.b2b.md message"`
		Data    string `xml:"http://ultra.b2b.md data"`
	} `xml:"http://ultra.b2b.md return"`
}

// CommitReceivingData structures
type CommitReceivingDataRequest struct {
	XMLName xml.Name `xml:"http://ultra.b2b.md CommitReceivingData"`
	Service string   `xml:"Service"`
}

// TestService structures
type TestServiceRequest struct {
	XMLName xml.Name `xml:"http://ultra.b2b.md testService"`
}

type TestServiceResponse struct {
	XMLName xml.Name `xml:"testServiceResponse"`
	Return  string   `xml:"http://ultra.b2b.md return"`
}

// TestService checks connection to the B2B API
func (c *Client) TestService(ctx context.Context) error {
	req := TestServiceRequest{}
	var resp TestServiceResponse

	if err := c.soapCall(ctx, req, &resp); err != nil {
		return err
	}

	// Accept both "OK" (Latin) and "ОК" (Cyrillic)
	if resp.Return != "OK" && resp.Return != "ОК" {
		return fmt.Errorf("unexpected response: %s", resp.Return)
	}

	return nil
}

// RequestData initiates async data request
func (c *Client) RequestData(ctx context.Context, service RequestType, all bool, additionalParams string) (string, error) {
	req := RequestDataRequest{
		Service:              string(service),
		All:                  all,
		AdditionalParameters: additionalParams,
		Compress:             false,
	}

	var resp RequestDataResponse
	if err := c.soapCall(ctx, req, &resp); err != nil {
		return "", err
	}

	return resp.Return, nil
}

// IsReady checks if data is ready
func (c *Client) IsReady(ctx context.Context, requestID string) (bool, error) {
	req := IsReadyRequest{ID: requestID}
	var resp IsReadyResponse

	if err := c.soapCall(ctx, req, &resp); err != nil {
		return false, err
	}

	return resp.Return, nil
}

// WaitForReady polls until data is ready (no timeout)
func (c *Client) WaitForReady(ctx context.Context, requestID string) error {
	ticker := time.NewTicker(c.config.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("context canceled while waiting for data: %w", ctx.Err())
		case <-ticker.C:
			ready, err := c.IsReady(ctx, requestID)
			if err != nil {
				return fmt.Errorf("check ready: %w", err)
			}
			if ready {
				return nil
			}
		}
	}
}

// GetData retrieves prepared data
func (c *Client) GetData(ctx context.Context, requestID string) (string, error) {
	req := GetDataByIDRequest{ID: requestID}
	var resp GetDataByIDResponse

	if err := c.soapCall(ctx, req, &resp); err != nil {
		return "", err
	}

	// Check message if present
	if resp.Return.Message != "" && resp.Return.Message != "OK" {
		return "", fmt.Errorf("API error: %s", resp.Return.Message)
	}

	// Unescape HTML entities
	xmlData := html.UnescapeString(resp.Return.Data)

	return xmlData, nil
}

// CommitReceiving confirms data receipt
func (c *Client) CommitReceiving(ctx context.Context, service RequestType) error {
	req := CommitReceivingDataRequest{Service: string(service)}

	// Response is empty/void
	if err := c.soapCall(ctx, req, nil); err != nil {
		return err
	}

	return nil
}

// FetchDataAsync performs complete request → poll → fetch cycle
func (c *Client) FetchDataAsync(ctx context.Context, service RequestType, all bool, additionalParams string) (string, error) {
	// Step 1: Request data
	requestID, err := c.RequestData(ctx, service, all, additionalParams)
	if err != nil {
		return "", fmt.Errorf("request data: %w", err)
	}

	// Step 2: Wait for ready
	if err := c.WaitForReady(ctx, requestID); err != nil {
		return "", fmt.Errorf("wait for ready: %w", err)
	}

	// Step 3: Get data
	xmlData, err := c.GetData(ctx, requestID)
	if err != nil {
		return "", fmt.Errorf("get data: %w", err)
	}

	return xmlData, nil
}

// soapCall executes SOAP request with retry logic
func (c *Client) soapCall(ctx context.Context, request interface{}, response interface{}) error {
	var lastErr error

	for attempt := 0; attempt <= c.config.MaxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff
			time.Sleep(c.config.RequestInterval * time.Duration(attempt))
		}

		if err := c.doSOAPCall(ctx, request, response); err != nil {
			lastErr = err
			continue
		}

		return nil
	}

	return fmt.Errorf("max retries exceeded: %w", lastErr)
}

// doSOAPCall performs single SOAP request
func (c *Client) doSOAPCall(ctx context.Context, request interface{}, response interface{}) error {
	// Build SOAP envelope
	envelope := SOAPEnvelope{
		Body: SOAPBody{Content: request},
	}

	xmlData, err := xml.MarshalIndent(envelope, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	// Add XML declaration
	fullXML := []byte(xml.Header + string(xmlData))

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.config.APIURL, bytes.NewReader(fullXML))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "text/xml; charset=utf-8")
	httpReq.SetBasicAuth(c.config.Username, c.config.Password)

	// Execute request
	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer httpResp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	// Check for SOAP fault
	var genericEnv struct {
		Body struct {
			Fault *SOAPFault `xml:"Fault"`
		} `xml:"Body"`
	}

	if err := xml.Unmarshal(respBody, &genericEnv); err == nil {
		if genericEnv.Body.Fault != nil {
			return fmt.Errorf("SOAP fault: %s - %s", genericEnv.Body.Fault.Code, genericEnv.Body.Fault.String)
		}
	}

	// Parse response if needed
	if response != nil {
		// Create a temporary envelope to extract the body content
		tempEnv := struct {
			Body struct {
				Content []byte `xml:",innerxml"`
			} `xml:"Body"`
		}{}

		// First unmarshal to get the body content as raw XML
		if err := xml.Unmarshal(respBody, &tempEnv); err != nil {
			return fmt.Errorf("unmarshal envelope: %w", err)
		}

		// Now unmarshal the body content into the actual response
		if err := xml.Unmarshal(tempEnv.Body.Content, response); err != nil {
			return fmt.Errorf("unmarshal body content: %w", err)
		}
	}

	return nil
}
