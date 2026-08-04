import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Package, Plus, Check, ShoppingBag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface PinProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductPinned: (productId: string) => void;
  shopId?: string;
}

interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock_quantity: number | null;
}

export default function PinProductModal({
  isOpen,
  onClose,
  onProductPinned,
  shopId,
}: PinProductModalProps) {
  const { user, profile } = useAuthStore();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [userShopId, setUserShopId] = useState<string | null>(null);

  // Get user's shop
  useEffect(() => {
    if (!user) return;

    const fetchUserShop = async () => {
      const { data, error } = await supabase
        .from('MaiTroll_shops')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setUserShopId(data.id);
      }
    };

    fetchUserShop();
  }, [user]);

  // Fetch products from user's shop
  useEffect(() => {
    if (!userShopId) return;

    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('shop_items')
          .select('id, name, description, price, image_url, stock_quantity')
          .eq('shop_id', userShopId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error('Error fetching products:', err);
        toast.error('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [userShopId]);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProductSelect = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handlePinProducts = () => {
    selectedProducts.forEach((productId) => {
      onProductPinned(productId);
    });
    setSelectedProducts([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Pin Products</h2>
                <p className="text-gray-400 text-sm">Select products to display during your stream</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search your products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl10 pr4 py-3 text-white placeholder-gray-500"
              />
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {!userShopId ? (
              <div className="text-center py-8">
                <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">You need to create a shop first</p>
                <p className="text-gray-500 text-sm mt-2">Go to Sell on Mai Troll to set up your shop</p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No products found</p>
                <p className="text-gray-500 text-sm mt-2">
                  {searchQuery ? 'Try a different search term' : 'Add products to your shop first'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((product) => (
                  <motion.button
                    key={product.id}
                    onClick={() => handleProductSelect(product.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'relative p-3 rounded-xl border-2 text-left transition-all',
                      selectedProducts.includes(product.id)
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    )}
                  >
                    {/* Selection Indicator */}
                    {selectedProducts.includes(product.id) && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {/* Product Image */}
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-24 object-cover rounded-lg mb-3"
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-600" />
                      </div>
                    )}

                    {/* Product Info */}
                    <h3 className="text-white font-medium text-sm truncate">{product.name}</h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-purple-400 font-bold">{product.price} coins</span>
                      {product.stock_quantity !== null && (
                        <span className="text-gray-500 text-xs">
                          {product.stock_quantity > 0 ? `${product.stock_quantity} left` : 'Out of stock'}
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">
                {selectedProducts.length > 0
                  ? `${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''} selected`
                  : 'Select products to pin'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePinProducts}
                  disabled={selectedProducts.length === 0}
                  className={cn(
                    'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors',
                    selectedProducts.length > 0
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  )}
                >
                  <Plus className="w-4 h-4" />
                  Pin Products
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
