import { Router } from 'express';
import {
  reportByAirlineValidation,
  reportByRouteValidation,
  reportByMonthValidation,
  handleValidationErrors,
} from '../ReportCtrl/report.validator';
import { getRevenueByAirline, getRevenueByRoute, getRevenueByMonth } from '../ReportCtrl/report.controller';
import { authMiddleware } from '../shared/middlewares/auth.middleware';
import { authorize } from '../shared/middlewares/authorize.middleware';

const reportRoutes = Router();

// GET /api/admin/reports/airline?startDate=&endDate=
reportRoutes.get('/airline', authMiddleware, authorize('admin'), reportByAirlineValidation, handleValidationErrors, getRevenueByAirline);

// GET /api/admin/reports/route?startDate=&endDate=
reportRoutes.get('/route', authMiddleware, authorize('admin'), reportByRouteValidation, handleValidationErrors, getRevenueByRoute);

// GET /api/admin/reports/monthly?year=
reportRoutes.get('/monthly', authMiddleware, authorize('admin'), reportByMonthValidation, handleValidationErrors, getRevenueByMonth);

export default reportRoutes;
