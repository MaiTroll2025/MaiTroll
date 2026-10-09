import { createContext, useContext, useReducer, useEffect, ReactNode } from "react"
import { MerchCartItem, PrintifyProduct, PrintifyVariant } from "./merchTypes"

interface CartState {
  items: MerchCartItem[]
  isOpen: boolean
}

type CartAction =
  | { type: "ADD_ITEM"; payload: Omit<MerchCartItem, "id"> }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "CLEAR_CART" }
  | { type: "TOGGLE_CART" }
  | { type: "SET_CART_OPEN"; payload: boolean }
  | { type: "LOAD_CART"; payload: MerchCartItem[] }

function generateCartItemId(productId: string, variantId: string): string {
  return `${productId}-${variantId}`
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existingId = generateCartItemId(action.payload.printify_product_id, action.payload.printify_variant_id)
      const existingIndex = state.items.findIndex((item) => item.id === existingId)

      if (existingIndex >= 0) {
        const newItems = [...state.items]
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + action.payload.quantity,
          total_price: (newItems[existingIndex].quantity + action.payload.quantity) * action.payload.unit_price,
        }
        return { ...state, items: newItems, isOpen: true }
      }

      return {
        ...state,
        items: [...state.items, { ...action.payload, id: existingId }],
        isOpen: true,
      }
    }

    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((item) => item.id !== action.payload) }

    case "UPDATE_QUANTITY": {
      const itemIndex = state.items.findIndex((item) => item.id === action.payload.id)
      if (itemIndex === -1) return state

      const newQuantity = Math.max(1, Math.min(99, action.payload.quantity))
      const newItems = [...state.items]
      newItems[itemIndex] = {
        ...newItems[itemIndex],
        quantity: newQuantity,
        total_price: newQuantity * newItems[itemIndex].unit_price,
      }
      return { ...state, items: newItems }
    }

    case "CLEAR_CART":
      return { ...state, items: [] }

    case "TOGGLE_CART":
      return { ...state, isOpen: !state.isOpen }

    case "SET_CART_OPEN":
      return { ...state, isOpen: action.payload }

    case "LOAD_CART":
      return { ...state, items: action.payload }

    default:
      return state
  }
}

interface CartContextValue {
  items: MerchCartItem[]
  isOpen: boolean
  subtotal: number
  itemCount: number
  addItem: (product: PrintifyProduct, variant: PrintifyVariant, quantity?: number) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  toggleCart: () => void
  setCartOpen: (open: boolean) => void
  getVariantForItem: (productId: string, variantId: string) => PrintifyVariant | undefined
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = "maitroll_merch_cart"

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isOpen: false,
  })

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const items = JSON.parse(stored)
        dispatch({ type: "LOAD_CART", payload: items })
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  // Save cart to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
    } catch {
      // Ignore write errors
    }
  }, [state.items])

  const addItem = (product: PrintifyProduct, variant: PrintifyVariant, quantity = 1) => {
    const unitPrice = (variant.price || 0) / 100
    dispatch({
      type: "ADD_ITEM",
      payload: {
        printify_product_id: product.id,
        printify_variant_id: variant.id,
        quantity,
        product_title: product.title,
        variant_title: variant.title,
        size: variant.options?.size as string | undefined,
        color: variant.options?.color as string | undefined,
        unit_price: unitPrice,
        total_price: unitPrice * quantity,
        product_image: product.images?.find((img) => img.is_primary)?.src || product.images?.[0]?.src,
      },
    })
  }

  const removeItem = (id: string) => dispatch({ type: "REMOVE_ITEM", payload: id })

  const updateQuantity = (id: string, quantity: number) =>
    dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } })

  const clearCart = () => dispatch({ type: "CLEAR_CART" })
  const toggleCart = () => dispatch({ type: "TOGGLE_CART" })
  const setCartOpen = (open: boolean) => dispatch({ type: "SET_CART_OPEN", payload: open })

  const getVariantForItem = (_productId: string, _variantId: string): PrintifyVariant | undefined => {
    // This would need access to product data - handled at component level
    return undefined
  }

  const subtotal = state.items.reduce((sum, item) => sum + item.total_price, 0)
  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        isOpen: state.isOpen,
        subtotal,
        itemCount,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        toggleCart,
        setCartOpen,
        getVariantForItem,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}