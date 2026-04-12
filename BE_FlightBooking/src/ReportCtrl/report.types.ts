export interface ReportQuery {
  startDate: string;
  endDate: string;
}

export interface RevenueByAirline {
  airline_name: string;
  airline_code: string;
  totalBookings: number;
  totalRevenue: number;
}

export interface RevenueByRoute {
  departure_city: string;
  departure_code: string;
  arrival_city: string;
  arrival_code: string;
  totalBookings: number;
  totalRevenue: number;
}

export interface MonthlyRevenue {
  month: number;
  year: number;
  totalRevenue: number;
  totalBookings: number;
}
