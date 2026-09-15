// printify-products Edge Function
// Automatically discovers the MAiTROLL Printify shop ID using the
// PRINTIFY_API_KEY, then retrieves the complete product catalog.
//
// Required Supabase secret:
//   PRINTIFY_API_KEY
//
// PRINTIFY_SHOP_ID is NO LONGER required.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import {
  withCors,
  handleCorsPreflight,
  unauthorizedResponse,
} from "../_shared/cors.ts"

const PRINTIFY_API_BASE = "https://api.printify.com"
const REQUEST_TIMEOUT_MS = 30000

interface PrintifyShop {
  id: number
  title: string
  sales_channel?: string
}

interface PrintifyVariant {
  id: string | number
  title: string
  size?: string
  color?: string
  sku?: string
  price?: number
  is_available?: boolean
  quantity?: number
  options?: Record<string, unknown>
}

interface PrintifyProduct {
  id: string
  title: string
  description?: string
  images?: Array<{
    src: string
    width?: number
    height?: number
    is_primary?: boolean
  }>
  variants?: PrintifyVariant[]
  status?: string
  published_at?: string
  created_at?: string
  updated_at?: string
  blueprint_id?: number
  provider?: string
  tags?: string[]
  category?: string
  type?: string
  options?: Array<{
    name: string
    type: string
    values?: Array<{
      id: string
      title: string
    }>
  }>
}

interface PrintifyProductsResponse {
  data?: PrintifyProduct[]
  next_page?: string
  last_page?: number
  current_page?: number
  total?: number
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()

  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

function getApiKey(): string | null {
  return Deno.env.get("PRINTIFY_API_KEY") || null
}

/**
 * Retrieves all shops connected to the Printify account.
 *
 * Printify returns:
 * [
 *   {
 *     id: 123456,
 *     title: "MAiTROLL",
 *     sales_channel: "API"
 *   }
 * ]
 */
async function getPrintifyShops(
  apiKey: string,
  requestId: string,
): Promise<PrintifyShop[]> {
  const endpoint = `${PRINTIFY_API_BASE}/v1/shops.json`

  console.log(
    `[PrintifyProducts ${requestId}] Retrieving Printify shops`,
  )

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MAiTroll-Merch/1.0",
      },
    },
    REQUEST_TIMEOUT_MS,
  )

  if (response.status === 401) {
    console.error(
      `[PrintifyProducts ${requestId}] Printify API authentication failed while retrieving shops`,
    )

    throw new Error("PRINTIFY_AUTH_FAILED")
  }

  if (response.status === 403) {
    console.error(
      `[PrintifyProducts ${requestId}] Printify API access denied while retrieving shops`,
    )

    throw new Error("PRINTIFY_ACCESS_DENIED")
  }

  if (!response.ok) {
    const errorText = await response.text()

    console.error(
      `[PrintifyProducts ${requestId}] Printify shops API error: ${response.status}`,
      errorText.substring(0, 500),
    )

    throw new Error("PRINTIFY_SHOPS_API_ERROR")
  }

  const shops: PrintifyShop[] = await response.json()

  if (!Array.isArray(shops)) {
    console.error(
      `[PrintifyProducts ${requestId}] Unexpected shops response`,
    )

    throw new Error("INVALID_SHOPS_RESPONSE")
  }

  console.log(
    `[PrintifyProducts ${requestId}] Found ${shops.length} Printify shop(s)`,
  )

  return shops
}

/**
 * Select the MAiTROLL shop.
 *
 * We first look for an exact MAiTROLL title match.
 * Then we check for titles containing MAiTROLL.
 *
 * If there is only one shop, we safely use that shop.
 *
 * If there are multiple shops and none can be identified,
 * we stop instead of accidentally loading products from
 * the wrong store.
 */
function selectShop(
  shops: PrintifyShop[],
  requestId: string,
): PrintifyShop {
  if (shops.length === 0) {
    throw new Error("NO_PRINTIFY_SHOPS")
  }

  // Exact title match
  const exactMatch = shops.find(
    (shop) =>
      shop.title.trim().toLowerCase() === "maitroll",
  )

  if (exactMatch) {
    console.log(
      `[PrintifyProducts ${requestId}] Selected MAiTROLL shop: ${exactMatch.id}`,
    )

    return exactMatch
  }

  // Partial title match
  const partialMatches = shops.filter((shop) =>
    shop.title.toLowerCase().includes("maitroll"),
  )

  if (partialMatches.length === 1) {
    console.log(
      `[PrintifyProducts ${requestId}] Selected MAiTROLL shop by title: ${partialMatches[0].id}`,
    )

    return partialMatches[0]
  }

  // If there is only one shop, use it.
  if (shops.length === 1) {
    console.log(
      `[PrintifyProducts ${requestId}] Only one Printify shop found. Using shop: ${shops[0].id}`,
    )

    return shops[0]
  }

  console.error(
    `[PrintifyProducts ${requestId}] Multiple Printify shops found but MAiTROLL could not be identified`,
  )

  console.error(
    `[PrintifyProducts ${requestId}] Available shops:`,
    shops.map((shop) => ({
      id: shop.id,
      title: shop.title,
      sales_channel: shop.sales_channel,
    })),
  )

  throw new Error("MAITROLL_SHOP_NOT_IDENTIFIED")
}

Deno.serve(async (req) => {
  const requestId =
    `printify_products_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`

  console.log(
    `[PrintifyProducts ${requestId}] Request received`,
  )

  // CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  // Only GET is supported
  if (req.method !== "GET") {
    return withCors(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
      req,
    )
  }

  // Require Supabase authentication
  const authHeader = req.headers.get("authorization")

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    console.log(
      `[PrintifyProducts ${requestId}] Missing authorization header`,
    )

    return unauthorizedResponse(
      "Authorization required",
      req.headers.get("origin"),
    )
  }

  const apiKey = getApiKey()

  if (!apiKey) {
    console.error(
      `[PrintifyProducts ${requestId}] PRINTIFY_API_KEY not configured`,
    )

    return withCors(
      {
        success: false,
        error: "Printify API key not configured",
      },
      500,
      req,
    )
  }

  try {
    // ------------------------------------------------------------
    // STEP 1: Automatically discover the Printify shop
    // ------------------------------------------------------------

    const shops = await getPrintifyShops(
      apiKey,
      requestId,
    )

    const selectedShop = selectShop(
      shops,
      requestId,
    )

    const shopId = String(selectedShop.id)

    console.log(
      `[PrintifyProducts ${requestId}] Using Printify shop "${selectedShop.title}" (${shopId})`,
    )

    // ------------------------------------------------------------
    // STEP 2: Parse request parameters
    // ------------------------------------------------------------

    const url = new URL(req.url)

    const includeDrafts =
      url.searchParams.get("include_drafts") === "true"

    const requestedLimit = parseInt(
      url.searchParams.get("limit") || "50",
      10,
    )

    // Printify's documented maximum for products is 50.
    const limit = Math.min(
      Math.max(
        Number.isNaN(requestedLimit)
          ? 50
          : requestedLimit,
        1,
      ),
      50,
    )

    const requestedPage = parseInt(
      url.searchParams.get("page") || "1",
      10,
    )

    const startingPage = Math.max(
      Number.isNaN(requestedPage)
        ? 1
        : requestedPage,
      1,
    )

    console.log(
      `[PrintifyProducts ${requestId}] Fetching products from shop ${shopId}`,
    )

    // ------------------------------------------------------------
    // STEP 3: Retrieve products
    // ------------------------------------------------------------

    const allProducts: PrintifyProduct[] = []

    let currentPage = startingPage
    let hasNext = true
    let totalPages = 1

    // Safety limit: maximum 10 pages per request.
    // With Printify's 50-product maximum, that is up to 500 products.
    let pagesFetched = 0

    while (
      hasNext &&
      pagesFetched < 10
    ) {
      const endpoint =
        `${PRINTIFY_API_BASE}/v1/shops/${shopId}/products.json` +
        `?limit=${limit}&page=${currentPage}`

      console.log(
        `[PrintifyProducts ${requestId}] Requesting products page ${currentPage}`,
      )

      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": "MAiTroll-Merch/1.0",
          },
        },
        REQUEST_TIMEOUT_MS,
      )

      if (response.status === 401) {
        console.error(
          `[PrintifyProducts ${requestId}] Printify API authentication failed`,
        )

        return withCors(
          {
            success: false,
            error: "Printify authentication failed",
          },
          500,
          req,
        )
      }

      if (response.status === 403) {
        console.error(
          `[PrintifyProducts ${requestId}] Printify API access denied`,
        )

        return withCors(
          {
            success: false,
            error: "Printify access denied",
          },
          503,
          req,
        )
      }

      if (response.status === 404) {
        console.error(
          `[PrintifyProducts ${requestId}] Printify shop ${shopId} was not found`,
        )

        return withCors(
          {
            success: false,
            error: "Printify shop not found",
            shop_id: shopId,
          },
          502,
          req,
        )
      }

      if (!response.ok) {
        const errorText = await response.text()

        console.error(
          `[PrintifyProducts ${requestId}] Printify API error: ${response.status}`,
          errorText.substring(0, 500),
        )

        return withCors(
          {
            success: false,
            error: "Printify API error",
            status: response.status,
          },
          502,
          req,
        )
      }

      const data: PrintifyProductsResponse =
        await response.json()

      const products = data.data || []

      // ----------------------------------------------------------
      // Filter drafts unless explicitly requested
      // ----------------------------------------------------------

      const filteredProducts = includeDrafts
        ? products
        : products.filter(
            (product) =>
              product.status !== "draft",
          )

      allProducts.push(
        ...filteredProducts,
      )

      totalPages =
        data.last_page || 1

      pagesFetched++

      console.log(
        `[PrintifyProducts ${requestId}] Page ${currentPage}: ${filteredProducts.length} products`,
      )

      currentPage++

      hasNext =
        currentPage <= totalPages &&
        pagesFetched < 10
    }

    // ------------------------------------------------------------
    // STEP 4: Return the catalog
    // ------------------------------------------------------------

    console.log(
      `[PrintifyProducts ${requestId}] Success: Retrieved ${allProducts.length} products`,
    )

    return withCors(
      {
        success: true,

        products: allProducts,

        total: allProducts.length,

        // This lets you see the actual Printify Shop ID
        // in the browser/network response.
        shop_id: shopId,

        shop_title: selectedShop.title,

        sales_channel:
          selectedShop.sales_channel || null,

        pages_fetched: pagesFetched,

        total_pages: totalPages,

        request_id: requestId,
      },
      200,
      req,
    )
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : String(err)

    console.error(
      `[PrintifyProducts ${requestId}] Error:`,
      err,
    )

    if (
      message.includes("abort") ||
      message.includes("timed out")
    ) {
      return withCors(
        {
          success: false,
          error: "Printify request timed out",
        },
        504,
        req,
      )
    }

    if (
      message === "PRINTIFY_AUTH_FAILED"
    ) {
      return withCors(
        {
          success: false,
          error:
            "Printify API authentication failed. Check PRINTIFY_API_KEY.",
        },
        500,
        req,
      )
    }

    if (
      message === "PRINTIFY_ACCESS_DENIED"
    ) {
      return withCors(
        {
          success: false,
          error:
            "Printify API access denied.",
        },
        503,
        req,
      )
    }

    if (
      message === "NO_PRINTIFY_SHOPS"
    ) {
      return withCors(
        {
          success: false,
          error:
            "No Printify shops were found for this API key.",
        },
        404,
        req,
      )
    }

    if (
      message ===
      "MAITROLL_SHOP_NOT_IDENTIFIED"
    ) {
      return withCors(
        {
          success: false,
          error:
            "Multiple Printify shops were found, but the MAiTROLL shop could not be identified. Rename the correct Printify shop to MAiTROLL or configure a specific shop ID.",
        },
        409,
        req,
      )
    }

    if (
      message === "INVALID_SHOPS_RESPONSE"
    ) {
      return withCors(
        {
          success: false,
          error:
            "Printify returned an unexpected shops response.",
        },
        502,
        req,
      )
    }

    if (
      message === "PRINTIFY_SHOPS_API_ERROR"
    ) {
      return withCors(
        {
          success: false,
          error:
            "Failed to retrieve shops from Printify.",
        },
        502,
        req,
      )
    }

    return withCors(
      {
        success: false,
        error:
          "Failed to fetch products from Printify",
      },
      500,
      req,
    )
  }
})