import { Request, Response, NextFunction } from 'express';
import { businessRepository } from '../../business/repositories/business.repository';
import { createWidgetSchema, updateWidgetSchema } from '../validators/widget.validator';
import { widgetService } from '../services/widget.service';

async function resolveBusiness(req: Request): Promise<string | { error: string; status: number }> {
  const userId = req.user?.id;
  if (!userId) return { error: 'Unauthorized', status: 401 };
  const business = await businessRepository.findByUserId(userId);
  if (!business) return { error: 'Business not found', status: 404 };
  return business.id;
}

export class WidgetController {
  // GET /api/widget
  async getByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const widget = await widgetService.getWidgetByBusinessId(resolved);
      return res.status(200).json({ widget });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/widget
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const body = createWidgetSchema.parse(req.body);
      const widget = await widgetService.createWidget(resolved, body);
      return res.status(201).json({ message: 'Widget created successfully', widget });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/widget
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const body = updateWidgetSchema.parse(req.body);
      const widget = await widgetService.updateWidget(resolved, {
        title: body.title,
        theme: body.theme,
        position: body.position,
        isEnabled: body.isEnabled,
        customCss: body.customCss ?? undefined,
      });
      return res.status(200).json({ message: 'Widget updated successfully', widget });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/widget
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      await widgetService.deleteWidget(resolved);
      return res.status(200).json({ message: 'Widget deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }
}

export const widgetController = new WidgetController();
