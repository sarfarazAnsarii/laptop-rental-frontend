export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'vendor' | 'client';
  phone?: string;
  company?: string;
}

export interface Issue {
  id: number;
  inventory_id: number;
  reported_by: number;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
  admin_notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  inventory?: Inventory;
  reporter?: User;
}

export interface Inventory {
  id: number;
  asset_code: string;
  brand: string;
  model_no: string;
  cpu: string;
  ram: string;
  ssd: string;
  graphics: string;
  purchase_date: string;
  type: 'office' | 'vendor' | 'sold';
  vendor_id?: number;
  vendor_name?: string;
  vendor_location?: string;
  delivery_date?: string;
  return_date?: string;
  return_location?: string;
  status: 'available' | 'rented' | 'maintenance' | 'sold' | 'returned';
  notes?: string;
  created_at: string;
  updated_at: string;
  active_rental?: Rental;
}

export interface Rental {
  id: number;
  rental_no: string;
  inventory_id: number;
  client_id: number;
  created_by: number;
  start_date: string;
  end_date: string;
  duration_days: number;
  monthly_rental: number;
  pro_rental: number;
  quantity: number;
  total: number;
  gst_percent: number;
  gst_amount: number;
  grand_total: number;
  status: 'active' | 'completed' | 'cancelled' | 'overdue';
  remarks?: string;
  created_at: string;
  inventory?: Inventory;
  client?: User;
}

export interface DashboardSummary {
  total_laptops: number;
  available: number;
  rented: number;
  active_rentals: number;
  overdue_rentals: number;
  revenue_this_month: number;
}

export interface BillingCalculation {
  start_date: string;
  end_date: string;
  duration_days: number;
  monthly_rental: number;
  pro_rental: number;
  quantity: number;
  total: number;
  gst_percent: number;
  gst_amount: number;
  grand_total: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
