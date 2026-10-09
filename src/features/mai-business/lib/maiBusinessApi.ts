import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

export interface MaiBusinessProfile {
  id: string
  user_id: string
  program_role: 'student' | 'instructor'
  enrollment_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BusinessProfile {
  id: string
  user_id: string
  business_name: string | null
  business_idea: string | null
  business_stage: 'exploring' | 'preparing' | 'starting' | 'existing' | null
  industry: string | null
  monthly_budget: number | null
  funding_requested: number | null
  founder_name: string | null
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  title: string
  description: string | null
  duration_weeks: number
  is_active: boolean
  is_default: boolean
  final_exam_id: string | null
  passing_score: number
  max_attempts: number
  created_at: string
  updated_at: string
}

export interface CourseModule {
  id: string
  course_id: string
  week_number: number
  title: string
  description: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface Lesson {
  id: string
  module_id: string
  title: string
  content: any
  objectives: string[] | null
  examples: string[] | null
  key_terms: string[] | null
  order_index: number
  is_knowledge_check: boolean
  created_at: string
  updated_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  course_id: string
  module_id: string | null
  lesson_id: string | null
  status: 'available' | 'in_progress' | 'completed' | 'locked'
  progress_percent: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface FundingProgram {
  id: string
  name: string
  organization: string
  funding_type: string
  award_min: number | null
  award_max: number | null
  eligibility: string | null
  geography: string | null
  industry_restrictions: string | null
  requirements: string | null
  deadline: string | null
  official_source: string | null
  application_url: string | null
  last_verified_date: string | null
  status: 'active' | 'inactive' | 'expired'
  total_available: number | null
  total_allocated: number
  created_at: string
  updated_at: string
}

export interface FundingApplication {
  id: string
  user_id: string
  program_id: string
  status: 'draft' | 'submitted' | 'under_review' | 'needs_information' | 'approved' | 'denied' | 'withdrawn' | 'completed'
  requested_amount: number | null
  submitted_at: string | null
  decision_at: string | null
  reviewer_id: string | null
  decision_notes: string | null
  supporting_data: any
  created_at: string
  updated_at: string
}

export interface Resource {
  id: string
  name: string
  title?: string | null
  description: string | null
  category: string
  official_source: string | null
  url: string | null
  geography: string | null
  last_verified_date: string | null
  status: 'active' | 'inactive' | 'expired'
  created_at: string
  updated_at: string
}

export interface MarketplaceListing {
  id: string
  seller_id: string
  title: string
  description: string | null
  price: number
  currency: string
  category: string | null
  condition: string | null
  image_urls: string[] | null
  status: string
  is_local_pickup: boolean
  location_hint: string | null
  sold_at: string | null
  created_at: string
  updated_at: string
}

export interface MerchandiseProduct {
  id: string
  name: string
  description: string | null
  price_usd: number
  price_coins: number | null
  category: string
  image_url: string | null
  stock_quantity: number
  is_active: boolean
  is_college_specific: boolean
  institution_id: string | null
  created_at: string
  updated_at: string
}

export interface IdeaPost {
  id: string
  user_id: string
  title: string
  content: string
  category: 'idea' | 'question' | 'feedback' | 'suggestion' | 'showcase' | null
  is_anonymous: boolean
  like_count: number
  comment_count: number
  status: string
  created_at: string
  updated_at: string
}

export interface Institution {
  id: string
  name: string
  abbreviation: string | null
  domain: string | null
  country: string | null
  state: string | null
  city: string | null
  institution_type: string | null
  logo_url: string | null
  is_verified: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BusinessPlanSection {
  id: string
  user_id: string
  type: string
  title: string | null
  content: string | null
  status: 'not_started' | 'draft' | 'review' | 'approved'
  order_index: number
  created_at: string
  updated_at: string
}

export interface FAQItem {
  id: string
  category: string | null
  question: string
  answer: string
  display_order: number
  is_active: boolean
  created_at: string
}

export interface BusinessDocument {
  id: string
  user_id: string
  type: string
  title: string
  file_path: string | null
  file_name: string | null
  file_size: number | null
  status: string | null
  version: number
  related_id: string | null
  related_type: string | null
  created_at: string
  updated_at: string
}

export interface CreditAccount {
  id: string
  user_id: string
  credit_score: number
  credit_limit: number
  credit_used: number
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  account_id: string | null
  type: string
  amount: number
  description: string | null
  actor_id: string | null
  metadata: any
  created_at: string
}

export interface RecognitionRequest {
  id: string
  student_id: string
  instructor_id: string
  recognition_type: string
  reason: string
  status: 'pending' | 'denied' | 'fulfilled'
  reviewed_by: string | null
  reviewed_at: string | null
  decision_notes: string | null
  created_at: string
  updated_at: string
}

export interface CollegeContribution {
  id: string
  week_start: string
  week_end: string
  institution_id: string
  calculation_rule: string | null
  qualifying_revenue: number
  contribution_rate: number
  contribution_amount: number
  is_approved: boolean
  approved_by: string | null
  approved_at: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface BusinessFunding {
  id: string
  user_id: string
  funding_type: string
  amount: number
  purpose: string | null
  business_plan_ref: string | null
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

// =========================================================================
// API Functions
// =========================================================================

export const maiBusinessApi = {
  // --- Profiles ---
  async ensureProfile(): Promise<MaiBusinessProfile | null> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) { console.error('ensureProfile error:', error); return null }
    if (data) return data as MaiBusinessProfile
    // Auto-create if not exists
    const { data: created, error: createError } = await supabase
      .from('mai_business_profiles')
      .insert({ user_id: user.id, program_role: 'student', enrollment_date: new Date().toISOString() })
      .select()
      .maybeSingle()
    if (createError) { console.error('createProfile error:', createError); return null }
    return created as MaiBusinessProfile
  },

  async getProfile(): Promise<MaiBusinessProfile | null> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) { console.error('getProfile error:', error); return null }
    return data as MaiBusinessProfile
  },

  // --- Business ---
  async getBusiness(): Promise<BusinessProfile | null> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_businesses')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) { console.error('getBusiness error:', error); return null }
    return data as BusinessProfile
  },

  async upsertBusiness(business: Partial<BusinessProfile>): Promise<BusinessProfile | null> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_businesses')
      .upsert({ user_id: user.id, ...business })
      .select()
      .maybeSingle()
    if (error) { console.error('upsertBusiness error:', error); return null }
    return data as BusinessProfile
  },

  // --- Courses & Education ---
  async getDefaultCourse(): Promise<Course | null> {
    const { data, error } = await supabase
      .from('mai_business_courses')
      .select('*')
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle()
    if (error) { console.error('getDefaultCourse error:', error); return null }
    return data as Course
  },

  async getModules(courseId: string): Promise<CourseModule[]> {
    const { data, error } = await supabase
      .from('mai_business_course_modules')
      .select('*')
      .eq('course_id', courseId)
      .order('week_number')
    if (error) { console.error('getModules error:', error); return [] }
    return data as CourseModule[]
  },

  async getLessons(moduleId: string): Promise<Lesson[]> {
    const { data, error } = await supabase
      .from('mai_business_lessons')
      .select('*')
      .eq('module_id', moduleId)
      .order('order_index')
    if (error) { console.error('getLessons error:', error); return [] }
    return data as Lesson[]
  },

  async getProgress(courseId?: string): Promise<UserProgress[]> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return []
    let query = supabase
      .from('mai_business_progress')
      .select('*')
      .eq('user_id', user.id)
    if (courseId) query = query.eq('course_id', courseId)
    const { data, error } = await query
    if (error) { console.error('getProgress error:', error); return [] }
    return data as UserProgress[]
  },

  async updateLessonProgress(
    lessonId: string,
    courseId: string,
    moduleId: string,
    status: string,
    progress?: number,
  ) {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data: existing, error: fetchErr } = await supabase
      .from('mai_business_progress')
      .select('id')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle()
    if (fetchErr) { console.error('updateLessonProgress fetch error:', fetchErr); return null }

    if (existing) {
      const { error: updateErr } = await supabase
        .from('mai_business_progress')
        .update({ status, progress_percent: progress ?? 0, ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}) })
        .eq('id', existing.id)
      if (updateErr) { console.error('updateLessonProgress update error:', updateErr); return null }
    } else {
      const { error: insertErr } = await supabase
        .from('mai_business_progress')
        .insert({
          user_id: user.id,
          course_id: courseId,
          module_id: moduleId,
          lesson_id: lessonId,
          status,
          progress_percent: progress ?? 0,
          ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        })
      if (insertErr) { console.error('updateLessonProgress insert error:', insertErr); return null }
    }
    return { success: true }
  },

  // --- Funding ---
  async getFundingPrograms(): Promise<FundingProgram[]> {
    const { data, error } = await supabase
      .from('mai_business_funding_programs')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) { console.error('getFundingPrograms error:', error); return [] }
    return data as FundingProgram[]
  },

  async getUserFundingApplications(): Promise<FundingApplication[]> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('mai_business_funding_applications')
      .select('*, mai_business_funding_programs(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) { console.error('getUserFundingApplications error:', error); return [] }
    return data as FundingApplication[]
  },

  async createFundingApplication(programId: string, amount: number): Promise<FundingApplication | null> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_funding_applications')
      .insert({ user_id: user.id, program_id: programId, requested_amount: amount, status: 'draft' })
      .select()
      .maybeSingle()
    if (error) { console.error('createFundingApplication error:', error); return null }
    return data as FundingApplication
  },

  async submitFundingApplication(applicationId: string) {
    const { data, error } = await supabase.rpc('submit_funding_application', {
      p_application_id: applicationId
    })
    if (error) { console.error('submitFundingApplication error:', error); return null }
    return data as any
  },

  // --- Resources ---
  async getResources(category?: string): Promise<Resource[]> {
    let query = supabase
      .from('mai_business_resources')
      .select('*')
      .eq('status', 'active')
    if (category && category !== 'all') query = query.eq('category', category)
    const { data, error } = await query.order('name')
    if (error) { console.error('getResources error:', error); return [] }
    return data as Resource[]
  },

  // --- Idea Exchange ---
  async getIdeaPosts(): Promise<IdeaPost[]> {
    const { data, error } = await supabase
      .from('mai_business_idea_posts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) { console.error('getIdeaPosts error:', error); return [] }
    return data as IdeaPost[]
  },

  async createIdeaPost(title: string, content: string, category: string, isAnonymous = false) {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_idea_posts')
      .insert({ user_id: user.id, title, content, category, is_anonymous: isAnonymous })
      .select()
      .maybeSingle()
    if (error) { console.error('createIdeaPost error:', error); return null }
    return data as IdeaPost
  },

  // --- Student Feed ---
  async getFeedPosts(limit = 20, offset = 0) {
    const { data, error } = await supabase
      .from('mai_business_feed_posts')
      .select('*, user_profiles!inner(display_name, avatar_url, role)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)
    if (error) { console.error('getFeedPosts error:', error); return [] }
    return data
  },

  async createFeedPost(content: string, scope = 'global', isAnonymous = false) {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_feed_posts')
      .insert({ user_id: user.id, content, scope, is_anonymous: isAnonymous })
      .select()
      .maybeSingle()
    if (error) { console.error('createFeedPost error:', error); return null }
    return data
  },

  // --- Collaboration Discovery ---
  async getDiscoverableProfiles(interests?: string[]) {
    let query = supabase
      .from('mai_business_collaboration_profiles')
      .select('*')
      .eq('is_discoverable', true)
    if (interests && interests.length > 0) {
      query = query.overlaps('business_interests', interests)
    }
    const { data, error } = await query.limit(50)
    if (error) { console.error('getDiscoverableProfiles error:', error); return [] }
    return data
  },

  // --- Instructor Application ---
  async submitInstructorApplication(app: {
    name: string
    email: string
    expertise: string
    bio: string
    credential_info: any
    statement: string
    experience: string
  }) {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_applications')
      .insert({ user_id: user.id, type: 'instructor', status: 'pending', ...app })
      .select()
      .maybeSingle()
    if (error) { console.error('submitInstructorApplication error:', error); return null }
    return data
  },

  // --- Institutions ---
  async searchInstitutions(query: string): Promise<Institution[]> {
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,abbreviation.ilike.%${query}%,domain.ilike.%${query}%`)
      .order('name')
      .limit(20)
    if (error) { console.error('searchInstitutions error:', error); return [] }
    return data as Institution[]
  },

  async getInstitutionMembers(institutionId: string) {
    const { data, error } = await supabase
      .from('institution_members')
      .select('*, user_profiles!inner(display_name, avatar_url, role)')
      .eq('institution_id', institutionId)
      .eq('is_verified', true)
    if (error) { console.error('getInstitutionMembers error:', error); return [] }
    return data
  },

  // --- Documents ---
  async getUserDocuments() {
    const { user } = useAuthStore.getState()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('mai_business_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) { console.error('getUserDocuments error:', error); return [] }
    return data
  },

  // --- Business Plans ---
  async getBusinessPlan() {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_business_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('version', { ascending: false })
      .maybeSingle()
    if (error) { console.error('getBusinessPlan error:', error); return null }
    return data
  },

  async saveBusinessPlan(title: string, data: any, version?: number) {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data: result, error } = await supabase
      .from('mai_business_business_plans')
      .upsert({
        user_id: user.id,
        title,
        data,
        version: version ?? 1,
        status: 'draft'
      })
      .select()
      .maybeSingle()
    if (error) { console.error('saveBusinessPlan error:', error); return null }
    return result
  },

  // --- Marketplace ---
  async getMarketplaceListings(category?: string, limit = 20) {
    let query = supabase
      .from('mai_business_marketplace_listings')
      .select('*, user_profiles!inner(display_name)')
      .eq('status', 'available')
    if (category && category !== 'all') query = query.eq('category', category)
    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
    if (error) { console.error('getMarketplaceListings error:', error); return [] }
    return data
  },

  async createMarketplaceListing(listing: any) {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_marketplace_listings')
      .insert({ seller_id: user.id, ...listing })
      .select()
      .maybeSingle()
    if (error) { console.error('createMarketplaceListing error:', error); return null }
    return data
  },

  // --- Merchandise Store ---
  async getMerchandiseProducts() {
    const { data, error } = await supabase
      .from('mai_business_merchandise_products')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
    if (error) { console.error('getMerchandiseProducts error:', error); return [] }
    return data
  },

  async createMerchandiseOrder(order: {
    product_ids: string[]
    shipping_address?: any
  }) {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const products = await this.getMerchandiseProducts()
    const total = products
      .filter(p => order.product_ids.includes(p.id))
      .reduce((sum, p) => sum + Number(p.price_usd || 0), 0)
    const { data, error } = await supabase
      .from('mai_business_merchandise_orders')
      .insert({
        user_id: user.id,
        total_amount: total,
        shipping_address: order.shipping_address || null
      })
      .select()
      .maybeSingle()
    if (error) { console.error('createMerchandiseOrder error:', error); return null }
    // Insert order items
    const items = order.product_ids.map(pid => ({
      order_id: data!.id,
      product_id: pid,
      quantity: 1,
      unit_price: products.find(p => p.id === pid)?.price_usd || 0
    }))
    await supabase.from('mai_business_merchandise_order_items').insert(items)
    return data
  },

  // --- Credit ---
  async getCreditAccount() {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_credit_accounts')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) { console.error('getCreditAccount error:', error); return null }
    return data
  },

  async getCreditTransactions() {
    const { user } = useAuthStore.getState()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('mai_business_credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) { console.error('getCreditTransactions error:', error); return [] }
    return data
  },

  // --- Admin/CEO ---
  async isAdmin(): Promise<boolean> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return false
    const { data, error } = await supabase.rpc('mai_business_is_admin', { p_user_id: user.id })
    if (error) { console.error('isAdmin error:', error); return false }
    return !!data
  },

  async isInstructor(): Promise<boolean> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return false
    const { data, error } = await supabase.rpc('mai_business_is_instructor', { p_user_id: user.id })
    if (error) { console.error('isInstructor error:', error); return false }
    return !!data
  },

  async getInstructorApplications(status?: string) {
    let query = supabase
      .from('mai_business_applications')
      .select('*')
      .eq('type', 'instructor')
    if (status) query = query.eq('status', status)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) { console.error('getInstructorApplications error:', error); return [] }
    return data
  },

  async approveInstructorApplication(applicationId: string, decision: 'approved' | 'denied', notes?: string) {
    const { data, error } = await supabase.rpc('approve_instructor_application', {
      p_application_id: applicationId,
      p_decision: decision,
      p_notes: notes || null
    })
    if (error) { console.error('approveInstructorApplication error:', error); return null }
    return data
  },

  async getPendingInstructorApplications() {
    return this.getInstructorApplications('pending')
  },

  async validateFundingAvailability(programId: string, amount: number) {
    const { data, error } = await supabase.rpc('validate_funding_availability', {
      p_program_id: programId,
      p_amount: amount
    })
    if (error) { console.error('validateFundingAvailability error:', error); return null }
    return data
  },

  async allocateFunding(applicationId: string, amount: number, reason?: string) {
    const { data, error } = await supabase.rpc('allocate_funding', {
      p_application_id: applicationId,
      p_amount: amount,
      p_reason: reason || null
    })
    if (error) { console.error('allocateFunding error:', error); return null }
    return data
  },

  async getActivityLog(limit = 50) {
    const { data, error } = await supabase
      .from('mai_business_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) { console.error('getActivityLog error:', error); return [] }
    return data
  },

  async getCertificates() {
    const { user } = useAuthStore.getState()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('mai_business_certificates')
      .select('*, mai_business_courses(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) { console.error('getCertificates error:', error); return [] }
    return data
  },

  // --- Business Plan Sections ---
  async getBusinessPlanSections(): Promise<BusinessPlanSection[]> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('mai_business_business_plan_sections')
      .select('*')
      .eq('user_id', user.id)
      .order('order_index')
    if (error) { console.error('getBusinessPlanSections error:', error); return [] }
    return data as BusinessPlanSection[]
  },

  async updateBusinessPlanSection(sectionId: string, updates: { content?: string; status?: string; title?: string }) {
    const { data, error } = await supabase
      .from('mai_business_business_plan_sections')
      .update(updates)
      .eq('id', sectionId)
      .select()
      .maybeSingle()
    if (error) { console.error('updateBusinessPlanSection error:', error); return null }
    return data as BusinessPlanSection
  },

  // --- Funding Applications ---
  async getFunding(): Promise<BusinessFunding[]> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('mai_business_business_funding')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) { console.error('getFunding error:', error); return [] }
    return data as BusinessFunding[]
  },

  async createFundingSubmission(form: {
    funding_type: string
    amount: number
    purpose: string
    business_plan_ref?: string
  }): Promise<BusinessFunding | null> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('mai_business_business_funding')
      .insert({
        user_id: user.id,
        funding_type: form.funding_type,
        amount: form.amount,
        purpose: form.purpose,
        business_plan_ref: form.business_plan_ref || null,
        status: 'submitted',
      })
      .select()
      .maybeSingle()
    if (error) { console.error('submitFundingApplication error:', error); return null }
    return data as BusinessFunding
  },

  // --- Business Documents ---
  async getBusinessDocuments(): Promise<BusinessDocument[]> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('mai_business_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) { console.error('getBusinessDocuments error:', error); return [] }
    return data as BusinessDocument[]
  },

  // --- FAQs ---
  async getFAQs(): Promise<FAQItem[]> {
    const { data, error } = await supabase
      .from('mai_business_faq')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
    if (error) { console.error('getFAQs error:', error); return [] }
    return data as FAQItem[]
  },

  // --- Recognition & Contributions ---
  async getRecognitionRequests(): Promise<RecognitionRequest[]> {
    const { user } = useAuthStore.getState()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('mai_business_recognition_requests')
      .select('*')
      .or(`student_id.eq.${user.id},instructor_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    if (error) { console.error('getRecognitionRequests error:', error); return [] }
    return data as RecognitionRequest[]
  },

  async getCollegeContributions(): Promise<CollegeContribution[]> {
    const { data, error } = await supabase
      .from('mai_business_college_contributions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { console.error('getCollegeContributions error:', error); return [] }
    return data as CollegeContribution[]
  },

  async updateRecognitionRequest(id: string, status: 'fulfilled' | 'denied') {
    const { user } = useAuthStore.getState()
    const { data, error } = await supabase
      .from('mai_business_recognition_requests')
      .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) { console.error('updateRecognitionRequest error:', error); return null }
    return data
  },

  // --- MaiTroll Merch Store (isolated, USD only) ---
  async getMerchProducts() {
    const { data, error } = await supabase
      .from('mai_merch_products')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
    if (error) { console.error('getMerchProducts error:', error); return [] }
    return data
  },

  async getMerchOrders() {
    const { user } = useAuthStore.getState()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('mai_merch_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) { console.error('getMerchOrders error:', error); return [] }
    return data
  },

  async createMerchOrder(productIds: string[]) {
    const { user } = useAuthStore.getState()
    if (!user?.id) return null
    const { data, error } = await supabase.rpc('create_merch_order', {
      p_product_ids: productIds,
      p_shipping_address: null,
    })
    if (error) { console.error('createMerchOrder error:', error); return null }
    return data
  }
}