-- Fix Variant Grouping Script
-- This script re-runs the variant grouping algorithm with the improved regex
-- that properly handles Samsung RAM/Storage patterns (e.g., "12/256Gb")

-- ============================================================================
-- STEP 1: Clear existing variant groupings
-- ============================================================================
UPDATE products
SET variant_group_id = NULL, is_group = false
WHERE variant_group_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Apply new variant grouping with improved regex
-- ============================================================================
-- The improved regex handles:
-- - Standard patterns: "iPhone 16 Pro Max, 512GB" -> "iPhone 16 Pro Max"
-- - Samsung RAM/Storage: "Fold7 12/256Gb Jet Black" -> "Fold7 Jet Black"
-- - Case insensitive: GB, Gb, TB, Tb all handled

WITH variant_groups AS (
    SELECT
        brand_id,
        category_id,
        -- Extract base name by removing storage patterns
        trim(regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(name, '\d+/\d+\s*(Gb|Tb|GB|TB)', '', 'gi'),
                    ',?\s*\d+\s*(GB|TB)', '', 'gi'
                ),
                ',\s*', ' ', 'g'
            ),
            '\s+', ' ', 'g'
        )) as base_name,
        array_agg(id ORDER BY name) as product_ids,
        count(*) as variant_count
    FROM products
    WHERE is_active = true
    GROUP BY brand_id, category_id,
             trim(regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(name, '\d+/\d+\s*(Gb|Tb|GB|TB)', '', 'gi'),
                        ',?\s*\d+\s*(GB|TB)', '', 'gi'
                    ),
                    ',\s*', ' ', 'g'
                ),
                '\s+', ' ', 'g'
            ))
    HAVING count(*) > 1
)
UPDATE products p
SET
    variant_group_id = vg.product_ids[1],
    is_group = (p.id = vg.product_ids[1])
FROM variant_groups vg
WHERE p.id = ANY(vg.product_ids);

-- ============================================================================
-- STEP 3: Verify Samsung Fold7 products are now grouped
-- ============================================================================
SELECT
    'Samsung Fold7 Jet Black' as test_case,
    code,
    name,
    variant_group_id IS NOT NULL as is_grouped
FROM products
WHERE code IN ('235477', '235479', '235482')
ORDER BY code;

-- ============================================================================
-- STEP 4: Verify iPhone products are still grouped
-- ============================================================================
SELECT
    'iPhone 16 Pro Max MD' as test_case,
    code,
    name,
    variant_group_id IS NOT NULL as is_grouped
FROM products
WHERE code IN ('222008', '222009', '222010')
ORDER BY code;

-- ============================================================================
-- STEP 5: Show summary of variant groups created
-- ============================================================================
SELECT
    'Variant Groups Summary' as report,
    count(DISTINCT variant_group_id) as total_groups,
    count(*) as total_grouped_products
FROM products
WHERE variant_group_id IS NOT NULL;
