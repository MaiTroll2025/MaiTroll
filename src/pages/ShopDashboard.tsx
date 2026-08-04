import React, { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Plus, Edit, Trash, Package, DollarSign } from 'lucide-react'

export default function ShopDashboard() {
  const { user } = useAuthStore()
  const [shop, setShop] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editProduct, setEditProduct] = useState<any>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: ''
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load shop
      const { data: shopData } = await supabase
        .from('MaiTroll_shops')
        .select('*')
        .eq('owner_id', user!.id)
        .maybeSingle()
      
      setShop(shopData)

      if (shopData) {
        // Load products
        const { data: prodData } = await supabase
          .from('MaiTroll_products')
          .select('*')
          .eq('shop_id', shopData.id)
          .order('created_at', { ascending: false })
        setProducts(prodData || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user, loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.price) return toast.error('Name and price required')
    
    try {
      const price = parseInt(formData.price)
      if (isNaN(price) || price < 0) return toast.error('Invalid price')

      if (isEditing && editProduct) {
        // Update
        const { error } = await supabase
          .from('MaiTroll_products')
          .update({
            name: formData.name,
            description: formData.description,
            price_troll_coins: price,
            updated_at: new Date().toISOString()
          })
          .eq('id', editProduct.id)
        
        if (error) throw error
        toast.success('Product updated')
      } else {
        // Create
        const { error } = await supabase
          .from('MaiTroll_products')
          .insert([{
            shop_id: shop.id,
            name: formData.name,
            description: formData.description,
            price_troll_coins: price
          }])
        
        if (error) throw error
        toast.success('Product created')
      }
      
      setFormData({ name: '', description: '', price: '' })
      setIsEditing(false)
      setEditProduct(null)
      loadData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleEdit = (prod: any) => {
    setEditProduct(prod)
    setFormData({
      name: prod.name,
      description: prod.description || '',
      price: prod.price_troll_coins.toString()
    })
    setIsEditing(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return
    try {
      const { error } = await supabase.from('MaiTroll_products').delete().eq('id', id)
      if (error) throw error
      toast.success('Product deleted')
      loadData()
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (loading) return <div className="p-8 text-white">Loading...</div>

  if (!shop) return (
    <div className="p-8 text-white">
      <h2 className="text-xl mb-4">No Shop Found</h2>
      <p>Please create a shop first.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Package className="text-purple-400" />
              {shop.name} - Dashboard
            </h1>
            <p className="text-gray-400">Manage your products and listings</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] h-fit">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {isEditing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {isEditing ? 'Edit Product' : 'Add New Product'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Product Name</label>
                <input
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 outline-none"
                  placeholder="e.g. Rare Troll Card"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 outline-none resize-none h-24"
                  placeholder="Product details..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Price (Troll Coins)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded-lg font-semibold ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {isEditing ? 'Update Product' : 'Add Product'}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false)
                      setEditProduct(null)
                      setFormData({ name: '', description: '', price: '' })
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
            <h2 className="text-xl font-semibold mb-4">Your Products ({products.length})</h2>
            <div className="space-y-4">
              {products.map(prod => (
                <div key={prod.id} className="bg-[#0D0D0D] p-4 rounded-lg border border-[#2C2C2C] flex justify-between items-center group hover:border-purple-500/50 transition-colors">
                  <div>
                    <h3 className="font-bold text-lg">{prod.name}</h3>
                    <p className="text-gray-400 text-sm mb-1">{prod.description}</p>
                    <p className="text-yellow-400 font-semibold">{prod.price_troll_coins.toLocaleString()} Troll Coins</p>
                  </div>
                  <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(prod)}
                      className="p-2 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(prod.id)}
                      className="p-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No products listed yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
