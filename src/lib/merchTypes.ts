// Printify & Merch types for MAiTROLL frontend

export interface PrintifyVariant {
  id: string
  title: string
  size?: string
  color?: string
  sku?: string
  price?: number
  is_available?: boolean
  quantity?: number
  options?: Record<string, unknown>
}

export interface PrintifyImage {
  src: string
  width?: number
  height?: number
  is_primary?: boolean
}

export interface PrintifyOption {
  name: string
  type: string
  values?: Array<{ id: string; title: string }>
}

export interface PrintifyProduct {
  id: string
  title: string
  description?: string
  images?: PrintifyImage[]
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
  options?: PrintifyOption[]
}

export interface PrintifyProductsResponse {
  success: boolean
  products: PrintifyProduct[]
  total: number
  shop_id: string
  request_id: string
}

export interface MerchCartItem {
  id: string // client-side unique ID for cart management
  printify_product_id: string
  printify_variant_id: string
  quantity: number
  product_title: string
  variant_title: string
  size?: string
  color?: string
  unit_price: number
  total_price: number
  product_image?: string
}

export interface ShippingAddress {
  id?: string
  label?: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
  is_default?: boolean
  is_verified?: boolean
}

export interface MerchCheckoutRequest {
  items: Array<{
    printify_product_id: string
    printify_variant_id: string
    quantity: number
  }>
  shipping_address?: ShippingAddress
  address_id?: string
}

export interface MerchCheckoutResponse {
  success: boolean
  order_id: string
  order_number: string
  paypal_order_id: string
  approval_url: string
  subtotal: number
  shipping: number
  tax: number
  total: number
  currency: string
  request_id: string
  error?: string
}

export interface MerchPaymentCompleteRequest {
  paypal_order_id: string
  maitroll_order_id: string
}

export interface MerchPaymentCompleteResponse {
  success: boolean
  order_id: string
  order_number: string
  paypal_capture_id: string
  printify_order_id: string
  status: string
  already_processed?: boolean
  request_id: string
  error?: string
}

export interface MerchOrder {
  id: string
  order_number: string
  user_id: string
  subtotal: number
  shipping_amount: number
  tax_amount: number
  total_amount: number
  currency: string
  status: string
  payment_status: string
  fulfillment_status: string | null
  shipping_address: ShippingAddress
  customer_email: string
  paypal_order_id: string | null
  paypal_capture_id: string | null
  printify_order_id: string | null
  printify_external_id: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  tracking_url: string | null
  shipped_at: string | null
  delivered_at: string | null
  printify_error: string | null
  created_at: string
  updated_at: string
}

export interface MerchOrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  printify_product_id: string
  printify_variant_id: string
  variant_name: string
  size: string | null
  color: string | null
  sku: string | null
  product_image: string | null
  created_at: string
}

export interface MerchOrderWithItems extends MerchOrder {
  items: MerchOrderItem[]
}