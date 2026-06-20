import { Request, Response, NextFunction } from 'express';
import { businessRepository } from '../../business/repositories/business.repository';
import { websiteUrlSchema, updateWebsiteSchema } from '../validators/website.validator';
import { websiteService } from '../services/website.service';

async function resolveBusiness(req: Request): Promise<string | { error: string; status: number }> {
  const userId = req.user?.id;
  if (!userId) return { error: 'Unauthorized', status: 401 };
  const business = await businessRepository.findByUserId(userId);
  if (!business) return { error: 'Business not found', status: 404 };
  return business.id;
}

export class WebsiteController {
  // POST /api/website/url
  async setUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const body = websiteUrlSchema.parse(req.body);
      const website = await websiteService.setWebsiteUrl(resolved, body.url);
      return res.status(200).json({ message: 'Website URL set successfully', website });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/website
  async getByBusinessId(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const website = await websiteService.getWebsiteByBusinessId(resolved);
      return res.status(200).json({ website });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/website
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const body = updateWebsiteSchema.parse(req.body);
      const website = await websiteService.updateWebsite(resolved, {
        url: body.url,
        title: body.title ?? undefined,
        description: body.description ?? undefined,
        faviconUrl: body.faviconUrl ?? undefined,
      });
      return res.status(200).json({ message: 'Website updated successfully', website });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/website
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      await websiteService.deleteWebsite(resolved);
      return res.status(200).json({ message: 'Website deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/website/crawl
  async crawl(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const result = await websiteService.crawlWebsite(resolved);
      return res.status(200).json({
        message: 'Website crawled successfully',
        website: result.website,
        pagesCrawled: result.pagesCrawled,
      });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/website/recrawl
  async recrawl(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const result = await websiteService.recrawlWebsite(resolved);
      return res.status(200).json({
        message: 'Website recrawled successfully',
        website: result.website,
        pagesCrawled: result.pagesCrawled,
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/website/pages
  async getPages(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await resolveBusiness(req);
      if (typeof resolved !== 'string') {
        return res.status(resolved.status).json({ error: resolved.error });
      }
      const pages = await websiteService.getWebsitePages(resolved);
      return res.status(200).json({ pages });
    } catch (error) {
      return next(error);
    }
  }
}

export const websiteController = new WebsiteController();
