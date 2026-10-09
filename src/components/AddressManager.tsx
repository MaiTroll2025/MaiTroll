import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { ShippingAddress } from "@/lib/merchTypes"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Edit2, Check } from "lucide-react"

type AddressInput = Omit<ShippingAddress, "id" | "created_at" | "updated_at">

export function useSavedAddresses(userId?: string) {
  return useQuery({
    queryKey: ["saved-addresses", userId],
    queryFn: async () => {
      if (!userId) return []

      const { data, error } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })

      if (error) throw error
      return data as ShippingAddress[]
    },
    enabled: !!userId,
  })
}

export function useCreateAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (address: AddressInput) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("Not authenticated")
      }

      // Do not allow the client to establish verification status.
      const { is_verified: _ignoredVerification, ...safeAddress } = address

      const { data, error } = await supabase
        .from("user_addresses")
        .insert({
          ...safeAddress,
          user_id: user.id,
          is_verified: false,
        })
        .select()
        .single()

      if (error) throw error
      return data as ShippingAddress
    },
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({
        queryKey: ["saved-addresses"],
      })
    },
  })
}

export function useUpdateAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      ...address
    }: Partial<AddressInput> & { id: string; userId: string }) => {
      if (!userId) {
        throw new Error("Not authenticated")
      }

      // Never allow the client to modify verification status.
      const { is_verified: _ignoredVerification, ...safeAddress } = address

      const { data, error } = await supabase
        .from("user_addresses")
        .update(safeAddress)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single()

      if (error) throw error
      return data as ShippingAddress
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["saved-addresses"],
      })
    },
  })
}

export function useDeleteAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      userId,
    }: {
      id: string
      userId: string
    }) => {
      if (!userId) {
        throw new Error("Not authenticated")
      }

      const { error } = await supabase
        .from("user_addresses")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["saved-addresses"],
      })
    },
  })
}

export function AddressSelector({
  addresses,
  selectedAddressId,
  onSelect,
  onAddNew,
  onEdit,
  onDelete,
  isLoading,
}: {
  addresses: ShippingAddress[]
  selectedAddressId?: string
  onSelect: (id: string) => void
  onAddNew: () => void
  onEdit?: (address: ShippingAddress) => void
  onDelete?: (address: ShippingAddress) => void
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading shipping addresses">
        <div className="h-24 animate-pulse bg-zinc-800 rounded-lg" />
        <div className="h-24 animate-pulse bg-zinc-800 rounded-lg" />
      </div>
    )
  }

  if (addresses.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 mb-4">No saved addresses</p>
        <Button onClick={onAddNew} className="w-full">
          Add Shipping Address
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {addresses.map((address) => {
        const isSelected = address.id === selectedAddressId

        return (
          <div
            key={address.id}
            className={`relative p-4 rounded-lg border-2 transition-all ${
              isSelected
                ? "border-blue-500 bg-blue-500/10"
                : "border-zinc-700 hover:border-zinc-600"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <button
                type="button"
                className="flex-1 min-w-0 text-left cursor-pointer"
                onClick={() => onSelect(address.id)}
                aria-pressed={isSelected}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium">
                    {address.first_name} {address.last_name}
                  </span>

                  {address.is_default && (
                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                      Default
                    </span>
                  )}

                  {address.is_verified && (
                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                      Verified
                    </span>
                  )}
                </div>

                <p className="text-sm text-zinc-400">{address.address_line1}</p>

                {address.address_line2 && (
                  <p className="text-sm text-zinc-400">
                    {address.address_line2}
                  </p>
                )}

                <p className="text-sm text-zinc-400">
                  {address.city}, {address.state} {address.postal_code}
                </p>

                <p className="text-sm text-zinc-400">{address.country}</p>
                <p className="text-sm text-zinc-400">{address.email}</p>

                {address.phone && (
                  <p className="text-sm text-zinc-400">{address.phone}</p>
                )}
              </button>

              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => onSelect(address.id)}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Selected
                    </>
                  ) : (
                    "Select"
                  )}
                </Button>

                <div className="flex gap-1">
                  {onEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Edit ${address.first_name} ${address.last_name}'s address`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onEdit(address)
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}

                  {onDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10"
                      aria-label={`Delete ${address.first_name} ${address.last_name}'s address`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(address)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <Button type="button" variant="outline" onClick={onAddNew} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Add New Address
      </Button>
    </div>
  )
}

export function AddressForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initialData?: Partial<ShippingAddress>
  onSubmit: (data: AddressInput) => void
  onCancel: () => void
  isLoading?: boolean
}) {
  const [formData, setFormData] = useState<AddressInput>({
    label: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
    is_default: false,
    is_verified: false,
    ...initialData,
  })

  const updateField = <K extends keyof AddressInput>(
    field: K,
    value: AddressInput[K]
  ) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    // Verification is server-controlled; don't send a client-supplied value.
    const { is_verified: _ignoredVerification, ...safeFormData } = formData
    onSubmit(safeFormData as AddressInput)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="first_name">First Name *</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(event) => updateField("first_name", event.target.value)}
            required
            disabled={isLoading}
            autoComplete="given-name"
          />
        </div>

        <div>
          <Label htmlFor="last_name">Last Name *</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(event) => updateField("last_name", event.target.value)}
            required
            disabled={isLoading}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(event) => updateField("email", event.target.value)}
          required
          disabled={isLoading}
          autoComplete="email"
        />
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone || ""}
          onChange={(event) => updateField("phone", event.target.value)}
          disabled={isLoading}
          autoComplete="tel"
        />
      </div>

      <div>
        <Label htmlFor="address_line1">Address Line 1 *</Label>
        <Input
          id="address_line1"
          value={formData.address_line1}
          onChange={(event) => updateField("address_line1", event.target.value)}
          required
          disabled={isLoading}
          autoComplete="address-line1"
        />
      </div>

      <div>
        <Label htmlFor="address_line2">Address Line 2</Label>
        <Input
          id="address_line2"
          value={formData.address_line2 || ""}
          onChange={(event) => updateField("address_line2", event.target.value)}
          disabled={isLoading}
          autoComplete="address-line2"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(event) => updateField("city", event.target.value)}
            required
            disabled={isLoading}
            autoComplete="address-level2"
          />
        </div>

        <div>
          <Label htmlFor="state">State *</Label>
          <Input
            id="state"
            value={formData.state}
            onChange={(event) => updateField("state", event.target.value)}
            required
            disabled={isLoading}
            autoComplete="address-level1"
          />
        </div>

        <div>
          <Label htmlFor="postal_code">ZIP/Postal Code *</Label>
          <Input
            id="postal_code"
            value={formData.postal_code}
            onChange={(event) => updateField("postal_code", event.target.value)}
            required
            disabled={isLoading}
            autoComplete="postal-code"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="country">Country *</Label>
        <Input
          id="country"
          value={formData.country}
          onChange={(event) => updateField("country", event.target.value)}
          required
          disabled={isLoading}
          autoComplete="country"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_default"
          checked={!!formData.is_default}
          onCheckedChange={(checked) =>
            updateField("is_default", checked === true)
          }
          disabled={isLoading}
        />
        <Label htmlFor="is_default" className="text-sm">
          Set as default address
        </Label>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Address"}
        </Button>
      </div>
    </form>
  )
}

export function AddressManager({
  userId,
  onSelect,
}: { userId: string; onSelect?: (address: ShippingAddress) => void }) {
  const { data: addresses, isLoading } = useSavedAddresses(userId)
  const createAddress = useCreateAddress()
  const updateAddress = useUpdateAddress()
  const deleteAddress = useDeleteAddress()

  const [editingAddress, setEditingAddress] =
    useState<ShippingAddress | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(
    undefined
  )

  const handleSave = async (data: AddressInput) => {
    try {
      if (editingAddress) {
        await updateAddress.mutateAsync({
          id: editingAddress.id,
          userId,
          ...data,
        })
      } else {
        const created = await createAddress.mutateAsync(data)

        if (created?.id) {
          setSelectedAddressId(created.id)
        }
      }

      setEditingAddress(null)
      setShowAddForm(false)
    } catch (error) {
      console.error("Failed to save address:", error)
    }
  }

  const handleDelete = async (address: ShippingAddress) => {
    if (!confirm("Are you sure you want to delete this address?")) return

    try {
      await deleteAddress.mutateAsync({
        id: address.id,
        userId,
      })

      if (selectedAddressId === address.id) {
        setSelectedAddressId(undefined)
      }
    } catch (error) {
      console.error("Failed to delete address:", error)
    }
  }

  if (!userId) return null

  const mutationLoading =
    createAddress.isPending || updateAddress.isPending || deleteAddress.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Shipping Addresses</h2>

        <Button
          type="button"
          onClick={() => {
            setEditingAddress(null)
            setShowAddForm(true)
          }}
          disabled={mutationLoading}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Address
        </Button>
      </div>

      <AddressSelector
        addresses={addresses || []}
        selectedAddressId={selectedAddressId}
        onSelect={(id) => {
          setSelectedAddressId(id)
          const address = addresses?.find((a) => a.id === id)
          if (address && onSelect) {
            onSelect(address)
          }
        }}
        onAddNew={() => {
          setEditingAddress(null)
          setShowAddForm(true)
        }}
        onEdit={(address) => {
          setEditingAddress(address)
          setShowAddForm(false)
        }}
        onDelete={handleDelete}
        isLoading={isLoading}
      />

      {(editingAddress || showAddForm) && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open && !mutationLoading) {
              setEditingAddress(null)
              setShowAddForm(false)
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? "Edit Address" : "Add New Address"}
              </DialogTitle>

              <DialogDescription>
                {editingAddress
                  ? "Update your shipping address"
                  : "Add a new shipping address"}
              </DialogDescription>
            </DialogHeader>

            <AddressForm
              initialData={editingAddress || undefined}
              onSubmit={handleSave}
              onCancel={() => {
                if (!mutationLoading) {
                  setEditingAddress(null)
                  setShowAddForm(false)
                }
              }}
              isLoading={mutationLoading}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
