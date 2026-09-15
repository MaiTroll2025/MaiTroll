import { useState, useRef, useCallback, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/lib/store"
import { useCart } from "@/lib/cartContext"
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  Loader2,
  AlertCircle,
  Truck,
  CreditCard,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { AddressManager } from "@/components/AddressManager"

const EDGE_FUNCTIONS_URL =
  import.meta.env.VITE_EDGE_FUNCTIONS_URL || "/functions/v1"

async function fetchPrintifyProducts() {
  const session = (await supabase.auth.getSession()).data.session

  const response = await fetch(
    `${EDGE_FUNCTIONS_URL}/printify-products`,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error("Failed to fetch products")
  }

  return response.json()
}

async function checkoutCart(
  items: any[],
  shippingAddress: any,
  addressId?: string,
) {
  const session = (await supabase.auth.getSession()).data.session

  const response = await fetch(
    `${EDGE_FUNCTIONS_URL}/merch-checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({
        items,
        shipping_address: shippingAddress,
        address_id: addressId,
      }),
    },
  )

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.error || "Checkout failed")
  }

  return response.json()
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-300",
    payment_pending: "bg-yellow-500/20 text-yellow-300",
    paypal_approved: "bg-blue-500/20 text-blue-300",
    paid: "bg-blue-500/20 text-blue-300",
    printify_submission_pending: "bg-purple-500/20 text-purple-300",
    submitted_to_printify: "bg-purple-500/20 text-purple-300",
    in_production: "bg-purple-500/20 text-purple-300",
    shipped: "bg-blue-500/20 text-blue-300",
    delivered: "bg-green-500/20 text-green-300",
    cancelled: "bg-red-500/20 text-red-300",
    refunded: "bg-red-500/20 text-red-300",
    failed: "bg-red-500/20 text-red-300",
    printify_submission_failed: "bg-red-500/20 text-red-300",
  }

  return styles[status] || "bg-zinc-500/20 text-zinc-300"
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Printify descriptions can contain HTML markup.
 * Convert the common formatting tags to readable text so
 * customers never see raw <br>, </br>, <p>, etc.
 */
function ImageViewer({
  images,
  initialIndex,
  onClose,
}: {
  images: string[]
  initialIndex: number
  onClose: () => void
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)

  const resetTransform = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])
  const handleZoomIn = useCallback(() => setScale((v) => Math.min(v * 1.2, 5)), [])
  const handleZoomOut = useCallback(() => setScale((v) => Math.max(v / 1.2, 0.5)), [])
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [isDragging, dragStart])
  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft") setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1))
      else if (e.key === "ArrowRight") setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0))
      else if (e.key === "+" || e.key === "=") handleZoomIn()
      else if (e.key === "-") handleZoomOut()
      else if (e.key === "0") resetTransform()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [images.length, onClose, handleZoomIn, handleZoomOut, resetTransform, handleMouseMove, handleMouseUp])

  useEffect(() => resetTransform(), [currentIndex, resetTransform])
  if (!images.length) return null
  const currentImage = images[currentIndex]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95" onClick={onClose}>
      <div className="relative flex h-full w-full items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <img
          ref={imgRef}
          src={currentImage}
          alt={`Product image ${currentIndex + 1} of ${images.length}`}
          className="max-h-full max-w-full object-contain"
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, cursor: scale > 1 ? "grab" : "zoom-in" }}
          onDoubleClick={handleZoomIn}
          onMouseDown={(e) => {
            if (scale <= 1) return
            setIsDragging(true)
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
          }}
        />
        {images.length > 1 && <>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-zinc-900/80 p-2 text-white" onClick={() => setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1))} aria-label="Previous image"><ChevronLeft /></button>
          <button className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-zinc-900/80 p-2 text-white" onClick={() => setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0))} aria-label="Next image"><ChevronRight /></button>
        </>}
        <div className="absolute right-4 top-4 flex gap-2">
          <button className="rounded-full bg-zinc-900/80 p-2 text-white" onClick={handleZoomOut} disabled={scale <= 0.5} aria-label="Zoom out"><ZoomOut /></button>
          <button className="rounded-full bg-zinc-900/80 p-2 text-white" onClick={resetTransform} aria-label="Reset zoom"><RotateCcw /></button>
          <button className="rounded-full bg-zinc-900/80 p-2 text-white" onClick={handleZoomIn} disabled={scale >= 5} aria-label="Zoom in"><ZoomIn /></button>
          <button className="rounded-full bg-zinc-900/80 p-2 text-white" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900/80 px-4 py-2 text-sm text-white">{currentIndex + 1} / {images.length}</div>
      </div>
    </div>
  )
}

function cleanProductDescription(description?: string): string {
  if (!description) return ""

  return description
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/br\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<p(?:\s[^>]*)?>/gi, "")
    .replace(/<li(?:\s[^>]*)?>/gi, "• ")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function ProductCard({
  product,
  onSelect,
}: {
  product: any
  onSelect: (product: any) => void
}) {
  const primaryImage =
    product.images?.find((img: any) => img.is_primary)?.src ||
    product.images?.[0]?.src

  const prices =
    product.variants
      ?.map((variant: any) => Number(variant.price || 0) / 100)
      .filter((price: number) => price > 0) || []

  const lowestPrice = prices.length ? Math.min(...prices) : 0

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80 transition-all hover:border-pink-500/30"
      onClick={() => onSelect(product)}
    >
      {primaryImage ? (
        <div className="relative aspect-square w-full overflow-hidden bg-zinc-800">
          <img
            src={primaryImage}
            alt={product.title || "MAiTROLL merchandise"}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />

          {product.status === "draft" && (
            <div className="absolute left-2 top-2 rounded bg-red-500/90 px-2 py-0.5 text-xs text-white">
              Draft
            </div>
          )}
          {product.variants?.length > 0 && product.variants.every((v: any) => v.is_available === false || Number(v.quantity) === 0) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <span className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white">Out of Stock</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-zinc-800">
          <ShoppingBag className="h-12 w-12 text-zinc-600" />
        </div>
      )}

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h4 className="min-w-0 flex-1 truncate text-sm font-bold text-white">
            {product.title}
          </h4>

          <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
            {product.category || "other"}
          </span>
        </div>

        {product.description && (
          <p className="mb-3 line-clamp-2 text-xs text-slate-500">
            {cleanProductDescription(product.description)}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-pink-400">
            {formatPrice(lowestPrice)}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-pink-600 px-3 py-1.5 text-white hover:bg-pink-700"
            onClick={(event) => {
              event.stopPropagation()
              onSelect(product)
            }}
          >
            View
          </Button>
        </div>
      </div>
    </div>
  )
}

function ProductDetailDialog({
  product,
  selectedVariant,
  setSelectedVariant,
  quantity,
  setQuantity,
  onAddToCart,
  onClose,
}: {
  product: any
  selectedVariant: string | null
  setSelectedVariant: (id: string | null) => void
  quantity: number
  setQuantity: (quantity: number) => void
  onAddToCart: (product: any, variant: any) => void
  onClose: () => void
}) {
  const variants = product.variants || []

  const primaryImage =
    product.images?.find((img: any) => img.is_primary)?.src ||
    product.images?.[0]?.src

  const selectedVar =
    variants.find(
      (variant: any) => String(variant.id) === String(selectedVariant),
    ) || variants[0]

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [showImageViewer, setShowImageViewer] = useState(false)
  const allImages =
    product.images?.map((img: any) => img.src).filter(Boolean) || []

  const selectedStock =
    selectedVar?.is_available === false
      ? 0
      : Number.isFinite(Number(selectedVar?.quantity))
        ? Math.max(0, Math.floor(Number(selectedVar.quantity)))
        : null
  const maxQuantity =
    selectedStock === null ? 99 : Math.min(99, selectedStock)
  const safeQuantity =
    maxQuantity > 0 ? Math.min(Math.max(1, quantity), maxQuantity) : 0
  const selectedOutOfStock = maxQuantity === 0

  if (!variants.length) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="break-words pr-8 text-xl">
              {product.title}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-line break-words">
              {cleanProductDescription(product.description)}
            </DialogDescription>
          </DialogHeader>

          {primaryImage && (
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-zinc-900">
              <img
                src={primaryImage}
                alt={product.title}
                className="h-full w-full object-contain"
              />
            </div>
          )}

          <p className="text-sm text-slate-400">
            This product currently has no selectable variants.
          </p>
        </DialogContent>
      </Dialog>
    )
  }

  const currentVariantId = String(selectedVar?.id || "")

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-5xl overflow-hidden p-0 sm:w-[calc(100vw-2rem)]"
      >
        <div className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-white/10 px-5 py-4 sm:px-6">
            <DialogTitle className="break-words pr-8 text-xl text-white sm:text-2xl">
              {product.title}
            </DialogTitle>

            <DialogDescription className="sr-only">
              Product details for {product.title}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-w-0 grid-cols-1 gap-0 md:grid-cols-2">
            {/* Product image */}
            <div className="min-w-0 border-b border-white/10 bg-zinc-950/60 p-4 md:border-b-0 md:border-r md:p-6">
              <div className="aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-white cursor-zoom-in" onClick={() => setShowImageViewer(true)}>
                {primaryImage ? (
                  <img
                    src={allImages[selectedImageIndex] || primaryImage}
                    alt={product.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-900">
                    <ShoppingBag className="h-16 w-16 text-zinc-600" />
                  </div>
                )}
              </div>

              {product.images?.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {product.images.slice(0, 5).map((image: any, index: number) => (
                    <button
                      key={`${image.src}-${index}`}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      className={`aspect-square overflow-hidden rounded-md border bg-white transition-colors ${index === selectedImageIndex ? "border-pink-400 ring-2 ring-pink-400/40" : "border-white/10 hover:border-pink-400/50"}`}
                      aria-label={`Select image ${index + 1}`}
                    >
                      <img
                        src={image.src}
                        alt={`${product.title} ${index + 1}`}
                        className="h-full w-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product information */}
            <div className="min-w-0 space-y-5 p-5 sm:p-6">
              <div className="min-w-0">
                <h3 className="break-words text-xl font-bold text-white">
                  {product.title}
                </h3>

                {product.description && (
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-white/5 bg-zinc-900/50 p-4">
                    <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-400">
                      {cleanProductDescription(product.description)}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block text-sm font-medium text-slate-400">
                    Select Variant
                  </Label>

                  <Select
                    value={currentVariantId}
                    onValueChange={(value) => {
                      setSelectedVariant(value)
                      const next = variants.find((v: any) => String(v.id) === String(value))
                      const stock = next?.is_available === false ? 0 : (Number.isFinite(Number(next?.quantity)) ? Math.max(0, Math.floor(Number(next.quantity))) : null)
                      setQuantity(stock === 0 ? 1 : stock === null ? Math.max(1, quantity) : Math.min(Math.max(1, quantity), Math.min(99, stock)))
                    }}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Select variant" />
                    </SelectTrigger>

                    <SelectContent className="max-w-[calc(100vw-2rem)]">
                      {variants.map((variant: any) => (
                        <SelectItem
                          key={variant.id}
                          value={String(variant.id)}
                        >
                          <span className="break-words">
                            {variant.title} —{" "}
                            {formatPrice(
                              Number(variant.price || 0) / 100,
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedVar && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-zinc-800/50 p-4">
                      <span className="text-sm text-slate-400">Price</span>

                      <span className="text-xl font-bold text-pink-400">
                        {formatPrice(
                          Number(selectedVar.price || 0) / 100,
                        )}
                      </span>
                    </div>

                    <div className={`rounded-lg border p-3 text-sm ${selectedOutOfStock ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-green-500/20 bg-green-500/10 text-green-300"}`}>
                      {selectedOutOfStock ? "Out of Stock" : selectedStock === null ? "In Stock" : `${selectedStock} available`}
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm font-medium text-slate-400">
                        Quantity
                      </Label>

                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setQuantity(Math.max(1, safeQuantity - 1))
                          }
                          disabled={safeQuantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>

                        <span className="w-10 text-center text-xl font-bold text-white">
                          {quantity}
                        </span>

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setQuantity(Math.min(maxQuantity, safeQuantity + 1))
                          }
                          disabled={selectedOutOfStock || safeQuantity >= maxQuantity}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>

                        <input
                          type="number"
                          min="1"
                          max={maxQuantity || 1}
                          value={safeQuantity}
                          onChange={(event) => {
                            const value = parseInt(
                              event.target.value,
                              10,
                            )

                            setQuantity(
                              maxQuantity > 0
                                ? Math.min(maxQuantity, Math.max(1, Number.isNaN(value) ? 1 : value))
                                : 1,
                            )
                          }}
                          className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-center text-white"
                          aria-label="Quantity"
                        />
                      </div>
                    </div>

                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      onClick={() => {
                        if (!selectedOutOfStock && safeQuantity > 0) {
                          onAddToCart(product, selectedVar)
                          onClose()
                        }
                      }}
                      disabled={selectedOutOfStock || maxQuantity <= 0}
                    >
                      {selectedOutOfStock ? "Out of Stock" : `Add ${safeQuantity} to Cart`}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {showImageViewer && allImages.length > 0 && (
      <ImageViewer images={allImages} initialIndex={selectedImageIndex} onClose={() => setShowImageViewer(false)} />
    )}
    </>
  )
}

function AddressManagerDialog({
  userId,
  selectedAddress,
  onSelect,
  onClose,
  onComplete,
}: {
  userId: string | undefined
  selectedAddress: any
  onSelect: (address: any) => void
  onClose: () => void
  onComplete: (address: any) => void
}) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[90vh] overflow-y-auto sm:w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Select Shipping Address</DialogTitle>
          <DialogDescription>
            Choose a saved address or add a new one
          </DialogDescription>
        </DialogHeader>

        <AddressManager
          userId={userId}
          onSelect={onSelect}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button
            type="button"
            onClick={() => {
              if (selectedAddress) {
                onComplete(selectedAddress)
              }
            }}
            disabled={!selectedAddress}
          >
            Use Selected Address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OrdersPanel({
  orders,
  isLoading,
  onRefresh,
}: {
  orders: any[]
  isLoading: boolean
  onRefresh: () => void
}) {
  return (
    <div className="animate-slide-down rounded-xl border border-white/5 bg-zinc-900/50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-bold text-white">Recent Orders</h4>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <Loader2
            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="text-sm text-slate-500">No orders yet</div>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col justify-between gap-3 border-b border-white/5 py-3 last:border-0 sm:flex-row sm:items-center"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="text-xs text-slate-500">
                  {formatDate(order.created_at)}
                </span>

                <span className="font-mono text-sm text-white">
                  #{String(order.id).slice(0, 8)}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-bold text-yellow-400">
                  {formatPrice(order.total_amount)}
                </span>

                <div className="flex items-center gap-2">
                  {order.tracking_number && (
                    <a
                      href={order.tracking_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Track: {order.tracking_number}
                    </a>
                  )}

                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${getStatusBadge(
                      order.status,
                    )}`}
                  >
                    {formatStatus(order.status)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MaiMerchStore() {
  const { user } = useAuthStore()

  const {
    items,
    isOpen,
    subtotal,
    itemCount,
    addItem,
    removeItem,
    updateQuantity,
    toggleCart,
    setCartOpen,
  } = useCart()

  const [showOrders, setShowOrders] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [showAddressManager, setShowAddressManager] = useState(false)
  const [selectedShippingAddress, setSelectedShippingAddress] =
    useState<any>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const {
    data: productsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["printify-products"],
    queryFn: fetchPrintifyProducts,
    enabled: true,
  })

  const {
    data: ordersData,
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["merch-orders", user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error: queryError } = await supabase
        .from("mai_merch_orders")
        .select("*, mai_merch_order_items(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)

      if (queryError) throw queryError

      return data
    },
    enabled: !!user?.id,
  })

  const products = productsData?.products || []

  const handleCheckout = async (addressOverride?: any) => {
    if (!user?.id) {
      toast.error("Sign in to checkout")
      return
    }

    if (items.length === 0) {
      toast.error("Your cart is empty")
      return
    }

    const shippingAddress =
      addressOverride || selectedShippingAddress

    if (!shippingAddress) {
      toast.error("Please select a shipping address")
      return
    }

    setIsCheckingOut(true)
    setCheckoutError(null)

    try {
      const cartItems = items.map((item) => ({
        printify_product_id: item.printify_product_id,
        printify_variant_id: item.printify_variant_id,
        quantity: item.quantity,
      }))

      const result = await checkoutCart(
        cartItems,
        shippingAddress,
        shippingAddress.id,
      )

      if (result.approval_url) {
        window.location.href = result.approval_url
        return
      }

      if (result.error) {
        throw new Error(result.error)
      }

      toast.success("Checkout started")
    } catch (err: any) {
      const message =
        err instanceof Error
          ? err.message
          : "Checkout failed"

      setCheckoutError(message)
      toast.error(message)
    } finally {
      setIsCheckingOut(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-pink-400" />
        <span className="ml-3 text-slate-400">
          Loading merchandise...
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />

        <p className="text-red-400">
          Unable to load merchandise
        </p>

        <Button
          type="button"
          onClick={() => refetch()}
          className="mt-4"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-xl font-bold text-white">
            <ShoppingBag className="h-5 w-5 text-pink-400" />
            MaiTroll Merch Store
          </h3>

          <p className="text-sm text-slate-400">
            Official MaiTroll merchandise - USD via PayPal
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={showOrders ? "default" : "outline"}
            onClick={() => setShowOrders(!showOrders)}
            className="gap-2"
          >
            <Truck className="h-4 w-4" />
            My Orders
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={toggleCart}
            className="relative"
          >
            <ShoppingBag className="h-4 w-4" />
            Cart

            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-600 text-xs text-white">
                {itemCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Cart Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setCartOpen(false)}
          />

          <div className="z-10 flex h-full w-full flex-col border-l border-zinc-700 bg-zinc-900 sm:w-96">
            <div className="flex items-center justify-between border-b border-zinc-700 p-4">
              <h3 className="font-bold text-white">
                Cart ({itemCount})
              </h3>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCartOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-zinc-600" />

                  <p>Your cart is empty</p>

                  <Button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="mt-4"
                    variant="outline"
                  >
                    Continue Shopping
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex gap-3 rounded-lg bg-zinc-800/50 p-3"
                      >
                        {item.product_image && (
                          <img
                            src={item.product_image}
                            alt={item.product_title}
                            className="h-16 w-16 shrink-0 rounded object-cover"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-white">
                            {item.product_title}
                          </p>

                          <p className="text-sm text-slate-400">
                            {item.variant_title}
                          </p>

                          {item.size && (
                            <p className="text-xs text-slate-500">
                              Size: {item.size}
                            </p>
                          )}

                          {item.color && (
                            <p className="text-xs text-slate-500">
                              Color: {item.color}
                            </p>
                          )}

                          <p className="text-sm font-bold text-pink-400">
                            {formatPrice(item.unit_price)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <p className="font-bold text-white">
                            {formatPrice(item.total_price)}
                          </p>

                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  item.quantity - 1,
                                )
                              }
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>

                            <span className="w-7 text-center text-white">
                              {item.quantity}
                            </span>

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  item.quantity + 1,
                                )
                              }
                              disabled={item.quantity >= 99}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:bg-red-500/10"
                              onClick={() => removeItem(item.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Subtotal</span>
                      <span className="font-medium text-white">
                        {formatPrice(subtotal)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Shipping</span>
                      <span className="font-medium text-white">
                        Calculated at checkout
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Tax</span>
                      <span className="font-medium text-white">
                        Calculated at checkout
                      </span>
                    </div>

                    <Separator />

                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-white">Total</span>
                      <span className="text-pink-400">
                        {formatPrice(subtotal)} + shipping
                      </span>
                    </div>

                    {checkoutError && (
                      <p className="text-sm text-red-400">
                        {checkoutError}
                      </p>
                    )}

                    <Button
                      type="button"
                      className="mt-4 w-full"
                      size="lg"
                      onClick={() => {
                        setCartOpen(false)
                        setShowAddressManager(true)
                      }}
                      disabled={items.length === 0 || isCheckingOut}
                    >
                      {isCheckingOut ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                      )}
                      Checkout with PayPal
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product: any) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={(selected) => {
              setSelectedProduct(selected)

              const firstVariant = selected.variants?.[0]
              setSelectedVariant(
                firstVariant ? String(firstVariant.id) : null,
              )

              setSelectedQuantity(1)
            }}
          />
        ))}
      </div>

      {products.length === 0 && (
        <div className="py-12 text-center text-slate-500">
          <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-zinc-600" />

          <p>No merchandise available right now.</p>

          <Button
            type="button"
            onClick={() => refetch()}
            className="mt-4"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Orders Panel */}
      {showOrders && (
        <OrdersPanel
          orders={ordersData || []}
          isLoading={ordersLoading}
          onRefresh={refetchOrders}
        />
      )}

      {/* Product Detail Dialog */}
      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          selectedVariant={selectedVariant}
          setSelectedVariant={setSelectedVariant}
          quantity={selectedQuantity}
          setQuantity={setSelectedQuantity}
          onAddToCart={addItem}
          onClose={() => {
            setSelectedProduct(null)
            setSelectedVariant(null)
            setSelectedQuantity(1)
          }}
        />
      )}

      {/* Address Manager Dialog */}
      {showAddressManager && (
        <AddressManagerDialog
          userId={user?.id}
          selectedAddress={selectedShippingAddress}
          onSelect={setSelectedShippingAddress}
          onClose={() => setShowAddressManager(false)}
          onComplete={async (address) => {
            setSelectedShippingAddress(address)
            setShowAddressManager(false)
            await handleCheckout(address)
          }}
        />
      )}
    </div>
  )
}
