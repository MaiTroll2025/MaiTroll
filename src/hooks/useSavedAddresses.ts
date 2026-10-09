import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { ShippingAddress } from "@/lib/merchTypes"

export type AddressInput = Omit<ShippingAddress, "id" | "created_at" | "updated_at">

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
