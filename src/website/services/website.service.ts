import axios from 'axios';
import * as cheerio from 'cheerio';
import { Website, WebsitePage } from '@prisma/client';
import { websiteRepository } from '../repositories/website.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import logger from '../../utils/logger';
import {
  WebsiteCrawlCompletedEvent,
  WebsiteCrawlFailedEvent,
  WebsiteCrawlStartedEvent,
  WebsiteDeletedEvent,
  WebsiteUpdatedEvent,
} from '../events/website.event';
import { websiteListener } from '../listeners/website.listener';

export class WebsiteService {
  async setWebsiteUrl(businessId: string, url: string): Promise<Website> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const existing = await websiteRepository.findByBusinessId(businessId);
    const website = existing
      ? await websiteRepository.updateWebsite(existing.id, { url })
      : await websiteRepository.createWebsite({ businessId, url });

    await websiteListener.onWebsiteUpdated(
      new WebsiteUpdatedEvent(website.id, businessId, { url }),
    );
    return website;
  }

  async getWebsiteByBusinessId(businessId: string): Promise<Website> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');
    return website;
  }

  async updateWebsite(
    businessId: string,
    data: { url?: string; title?: string; description?: string; faviconUrl?: string },
  ): Promise<Website> {
    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');

    const sanitized: Parameters<typeof websiteRepository.updateWebsite>[1] = {};
    if (data.url !== undefined) sanitized.url = data.url;
    if (data.title !== undefined) sanitized.title = data.title;
    if (data.description !== undefined) sanitized.description = data.description;
    if (data.faviconUrl !== undefined) sanitized.faviconUrl = data.faviconUrl;

    const updated = await websiteRepository.updateWebsite(website.id, sanitized);
    await websiteListener.onWebsiteUpdated(
      new WebsiteUpdatedEvent(updated.id, businessId, {
        url: data.url,
        title: data.title,
        description: data.description,
        faviconUrl: data.faviconUrl,
      }),
    );
    return updated;
  }

  async deleteWebsite(businessId: string): Promise<Website> {
    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');

    const deleted = await websiteRepository.deleteWebsite(website.id);
    await websiteListener.onWebsiteDeleted(new WebsiteDeletedEvent(deleted.id, website.businessId));
    return deleted;
  }

  async deleteWebsiteForBusiness(businessId: string): Promise<Website> {
    return this.deleteWebsite(businessId);
  }

  async crawlWebsite(businessId: string): Promise<{ website: Website; pagesCrawled: number }> {
    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');

    await websiteRepository.updateCrawlStatus(website.id, 'in_progress');
    await websiteListener.onWebsiteCrawlStarted(
      new WebsiteCrawlStartedEvent(website.id, businessId),
    );

    try {
      const response = await axios.get<string>(website.url, {
        timeout: 10_000,
        headers: { 'User-Agent': 'AIBridge Website Crawler 1.0' },
        responseType: 'text',
      });

      const $ = cheerio.load(response.data);
      const title = $('title').first().text().trim() || undefined;
      const description =
        $('meta[name="description"]').attr('content') || undefined;
      const faviconHref =
        $('link[rel="icon"], link[rel="shortcut icon"]').attr('href') || undefined;

      let absoluteFaviconUrl: string | undefined = faviconHref ?? undefined;
      if (faviconHref && !faviconHref.startsWith('http')) {
        try {
          const base = new URL(website.url);
          absoluteFaviconUrl = new URL(faviconHref, base.origin).toString();
        } catch (err) {
          logger.warn({ err, faviconHref }, 'Failed to resolve absolute favicon URL');
        }
      }

      await websiteRepository.updateWebsite(website.id, {
        title: title ?? undefined,
        description: description ?? undefined,
        faviconUrl: absoluteFaviconUrl ?? undefined,
      });

      await websiteRepository.createPage({
        websiteId: website.id,
        url: website.url,
        title: title ?? undefined,
        summary: description ?? undefined,
      });

      await websiteRepository.updateCrawlStatus(website.id, 'completed', 1);

      await websiteListener.onWebsiteCrawlCompleted(
        new WebsiteCrawlCompletedEvent(website.id, businessId, 1),
      );

      return { website, pagesCrawled: 1 };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await websiteRepository.updateCrawlStatus(website.id, 'failed');
      await websiteListener.onWebsiteCrawlFailed(
        new WebsiteCrawlFailedEvent(website.id, businessId, message),
      );
      throw err;
    }
  }

  async recrawlWebsite(businessId: string): Promise<{ website: Website; pagesCrawled: number }> {
    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');

    await websiteRepository.deletePagesByWebsiteId(website.id);
    return this.crawlWebsite(businessId);
  }

  async getWebsitePages(businessId: string): Promise<WebsitePage[]> {
    const website = await websiteRepository.findByBusinessId(businessId);
    if (!website) throw new Error('Website not found for business');
    return websiteRepository.getPagesByWebsiteId(website.id);
  }
}

export const websiteService = new WebsiteService();
