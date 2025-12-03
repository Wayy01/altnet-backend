package repository

import (
	"context"
	"math"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
)

// CalculateProductDiscounts calculates and populates discount fields for a product
func (r *Repository) CalculateProductDiscounts(ctx context.Context, product *models.Product, promotionRepo *PromotionRepository) error {
	if product == nil {
		return nil
	}

	// Fetch active promotions for this product
	activePromotions, err := promotionRepo.GetActivePromotionsByProduct(ctx, product.ID)
	if err != nil {
		// If error, continue without promotions (non-fatal)
		activePromotions = []*models.Promotion{}
	}

	product.ActivePromotions = make([]models.Promotion, len(activePromotions))
	for i, promo := range activePromotions {
		product.ActivePromotions[i] = *promo
	}

	// Calculate effective discount percent
	effectiveDiscount := 0.0

	// Start with manual discount
	if product.ManualDiscountPercent != nil {
		effectiveDiscount = *product.ManualDiscountPercent
	}

	// Find the best promotion discount
	maxPromotionDiscount := 0.0
	var bestPromotion *models.Promotion

	for _, promo := range activePromotions {
		var promotionDiscount float64
		if promo.DiscountType == models.DiscountTypePercentage {
			promotionDiscount = promo.DiscountValue
		} else if promo.DiscountType == models.DiscountTypeFixedAmount {
			// Convert fixed amount to percentage based on MDL price
			if product.PriceMDL != nil && *product.PriceMDL > 0 {
				promotionDiscount = (promo.DiscountValue / *product.PriceMDL) * 100
			}
		}

		if promotionDiscount > maxPromotionDiscount {
			maxPromotionDiscount = promotionDiscount
			bestPromotion = promo
		}
	}

	// Use the maximum of manual discount and promotion discount
	if maxPromotionDiscount > effectiveDiscount {
		effectiveDiscount = maxPromotionDiscount
	}

	// Set effective discount if any discount applies
	if effectiveDiscount > 0 {
		product.EffectiveDiscountPercent = &effectiveDiscount

		// Calculate discounted prices
		if product.PriceMDL != nil {
			var discountedPrice float64
			if bestPromotion != nil && bestPromotion.DiscountType == models.DiscountTypeFixedAmount && maxPromotionDiscount > effectiveDiscount {
				// If best promotion is fixed amount, subtract it directly
				discountedPrice = math.Max(0, *product.PriceMDL-bestPromotion.DiscountValue)
			} else {
				// Apply percentage discount
				discountedPrice = *product.PriceMDL * (1 - effectiveDiscount/100)
			}
			// Round to 2 decimal places
			discountedPrice = math.Round(discountedPrice*100) / 100
			product.DiscountedPriceMDL = &discountedPrice
		}

		if product.PriceEUR != nil {
			var discountedPrice float64
			if bestPromotion != nil && bestPromotion.DiscountType == models.DiscountTypeFixedAmount && maxPromotionDiscount > effectiveDiscount {
				// Convert fixed amount from MDL to EUR if possible
				if product.PriceMDL != nil && *product.PriceMDL > 0 {
					amountInEUR := (bestPromotion.DiscountValue / *product.PriceMDL) * *product.PriceEUR
					discountedPrice = math.Max(0, *product.PriceEUR-amountInEUR)
				} else {
					discountedPrice = *product.PriceEUR * (1 - effectiveDiscount/100)
				}
			} else {
				discountedPrice = *product.PriceEUR * (1 - effectiveDiscount/100)
			}
			discountedPrice = math.Round(discountedPrice*100) / 100
			product.DiscountedPriceEUR = &discountedPrice
		}

		if product.PriceUSD != nil {
			var discountedPrice float64
			if bestPromotion != nil && bestPromotion.DiscountType == models.DiscountTypeFixedAmount && maxPromotionDiscount > effectiveDiscount {
				// Convert fixed amount from MDL to USD if possible
				if product.PriceMDL != nil && *product.PriceMDL > 0 {
					amountInUSD := (bestPromotion.DiscountValue / *product.PriceMDL) * *product.PriceUSD
					discountedPrice = math.Max(0, *product.PriceUSD-amountInUSD)
				} else {
					discountedPrice = *product.PriceUSD * (1 - effectiveDiscount/100)
				}
			} else {
				discountedPrice = *product.PriceUSD * (1 - effectiveDiscount/100)
			}
			discountedPrice = math.Round(discountedPrice*100) / 100
			product.DiscountedPriceUSD = &discountedPrice
		}
	}

	return nil
}

// CalculateProductsDiscounts calculates discounts for multiple products
func (r *Repository) CalculateProductsDiscounts(ctx context.Context, products []*models.Product, promotionRepo *PromotionRepository) error {
	if len(products) == 0 {
		return nil
	}

	// Collect all product IDs
	productIDs := make([]uuid.UUID, len(products))
	productMap := make(map[uuid.UUID]*models.Product)
	for i, product := range products {
		productIDs[i] = product.ID
		productMap[product.ID] = product
	}

	// Batch fetch all active promotions for these products
	query := `
		SELECT
			pp.product_id,
			p.id, p.name, p.description, p.discount_type, p.discount_value,
			p.start_date, p.end_date, p.is_active, p.priority, p.created_at, p.updated_at
		FROM product_promotions pp
		INNER JOIN promotions p ON p.id = pp.promotion_id
		WHERE pp.product_id = ANY($1)
		  AND p.is_active = TRUE
		  AND NOW() BETWEEN p.start_date AND p.end_date
		ORDER BY pp.product_id, p.priority DESC, p.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, productIDs)
	if err != nil {
		// Non-fatal error, continue without promotions
		return nil
	}
	defer rows.Close()

	// Map to store promotions per product
	productPromotions := make(map[uuid.UUID][]*models.Promotion)

	for rows.Next() {
		var productID uuid.UUID
		promotion := &models.Promotion{}
		if err := rows.Scan(
			&productID,
			&promotion.ID,
			&promotion.Name,
			&promotion.Description,
			&promotion.DiscountType,
			&promotion.DiscountValue,
			&promotion.StartDate,
			&promotion.EndDate,
			&promotion.IsActive,
			&promotion.Priority,
			&promotion.CreatedAt,
			&promotion.UpdatedAt,
		); err != nil {
			continue
		}
		productPromotions[productID] = append(productPromotions[productID], promotion)
	}

	// Calculate discounts for each product
	for productID, product := range productMap {
		activePromotions := productPromotions[productID]

		// Convert to non-pointer slice for the model
		product.ActivePromotions = make([]models.Promotion, len(activePromotions))
		for i, promo := range activePromotions {
			product.ActivePromotions[i] = *promo
		}

		// Calculate effective discount
		effectiveDiscount := 0.0

		// Start with manual discount
		if product.ManualDiscountPercent != nil {
			effectiveDiscount = *product.ManualDiscountPercent
		}

		// Find the best promotion discount
		maxPromotionDiscount := 0.0
		var bestPromotion *models.Promotion

		for _, promo := range activePromotions {
			var promotionDiscount float64
			if promo.DiscountType == models.DiscountTypePercentage {
				promotionDiscount = promo.DiscountValue
			} else if promo.DiscountType == models.DiscountTypeFixedAmount {
				// Convert fixed amount to percentage based on MDL price
				if product.PriceMDL != nil && *product.PriceMDL > 0 {
					promotionDiscount = (promo.DiscountValue / *product.PriceMDL) * 100
				}
			}

			if promotionDiscount > maxPromotionDiscount {
				maxPromotionDiscount = promotionDiscount
				bestPromotion = promo
			}
		}

		// Use the maximum of manual discount and promotion discount
		if maxPromotionDiscount > effectiveDiscount {
			effectiveDiscount = maxPromotionDiscount
		}

		// Set effective discount if any discount applies
		if effectiveDiscount > 0 {
			product.EffectiveDiscountPercent = &effectiveDiscount

			// Calculate discounted prices
			if product.PriceMDL != nil {
				var discountedPrice float64
				if bestPromotion != nil && bestPromotion.DiscountType == models.DiscountTypeFixedAmount {
					discountedPrice = math.Max(0, *product.PriceMDL-bestPromotion.DiscountValue)
				} else {
					discountedPrice = *product.PriceMDL * (1 - effectiveDiscount/100)
				}
				discountedPrice = math.Round(discountedPrice*100) / 100
				product.DiscountedPriceMDL = &discountedPrice
			}

			if product.PriceEUR != nil {
				var discountedPrice float64
				if bestPromotion != nil && bestPromotion.DiscountType == models.DiscountTypeFixedAmount {
					if product.PriceMDL != nil && *product.PriceMDL > 0 {
						amountInEUR := (bestPromotion.DiscountValue / *product.PriceMDL) * *product.PriceEUR
						discountedPrice = math.Max(0, *product.PriceEUR-amountInEUR)
					} else {
						discountedPrice = *product.PriceEUR * (1 - effectiveDiscount/100)
					}
				} else {
					discountedPrice = *product.PriceEUR * (1 - effectiveDiscount/100)
				}
				discountedPrice = math.Round(discountedPrice*100) / 100
				product.DiscountedPriceEUR = &discountedPrice
			}

			if product.PriceUSD != nil {
				var discountedPrice float64
				if bestPromotion != nil && bestPromotion.DiscountType == models.DiscountTypeFixedAmount {
					if product.PriceMDL != nil && *product.PriceMDL > 0 {
						amountInUSD := (bestPromotion.DiscountValue / *product.PriceMDL) * *product.PriceUSD
						discountedPrice = math.Max(0, *product.PriceUSD-amountInUSD)
					} else {
						discountedPrice = *product.PriceUSD * (1 - effectiveDiscount/100)
					}
				} else {
					discountedPrice = *product.PriceUSD * (1 - effectiveDiscount/100)
				}
				discountedPrice = math.Round(discountedPrice*100) / 100
				product.DiscountedPriceUSD = &discountedPrice
			}
		}
	}

	return nil
}
