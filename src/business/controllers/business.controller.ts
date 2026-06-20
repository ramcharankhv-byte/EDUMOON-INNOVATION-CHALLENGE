import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { businessService } from '../services/business.service';
import {
  createBusinessSchema,
  updateBusinessSchema,
  listBusinessesQuerySchema,
} from '../validators/business.validator';
import logger from '../../utils/logger';

export class BusinessController {
  // POST /api/business
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const existing = await businessService.getBusinessByUserId(userId);
      if (existing) {
        return res.status(409).json({ error: 'Business already exists for this user' });
      }
      const body = createBusinessSchema.parse(req.body);
      const business = await businessService.createBusiness({ userId, ...body });
      return res.status(201).json({ business });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/business
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listBusinessesQuerySchema.parse(req.query);
      const skip = (query.page - 1) * query.limit;
      const result = await businessService.listBusinesses(skip, query.limit, {
        industry: query.industry,
        name: query.name,
        isActive: query.isActive,
      });
      return res.status(200).json({
        businesses: result.businesses,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          pages: Math.ceil(result.total / query.limit),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/business/mine — current user's business
  async getMine(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const business = await businessService.getBusinessByUserId(userId);
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }
      return res.status(200).json({ business });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/business/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const business = await businessService.getBusinessById(id);
      return res.status(200).json({ business });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/business/:id — owner or admin only
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const body = updateBusinessSchema.parse(req.body);

      const business = await businessService.getBusinessById(id);
      if (
        req.user?.role !== Role.ADMIN &&
        req.user?.id !== business.userId
      ) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updated = await businessService.updateBusiness(id, body);
      return res.status(200).json({ business: updated });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/business/:id
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const business = await businessService.getBusinessById(id);
      if (
        req.user?.role !== Role.ADMIN &&
        req.user?.id !== business.userId
      ) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await businessService.deleteBusiness(id);
      return res.status(200).json({ message: 'Business deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/business/count
  async getCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await businessService.getBusinessCount();
      return res.status(200).json({ count });
    } catch (error) {
      logger.error('Business count failed', error);
      return next(error);
    }
  }
}

export const businessController = new BusinessController();
