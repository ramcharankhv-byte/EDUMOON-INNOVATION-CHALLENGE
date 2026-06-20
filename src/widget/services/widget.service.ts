import { Widget, Position, Theme } from '@prisma/client';
import { widgetRepository } from '../repositories/widget.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import {
  WidgetCreatedEvent,
  WidgetDeletedEvent,
  WidgetUpdatedEvent,
} from '../events/widget.event';
import { widgetListener } from '../listeners/widget.listener';

export interface CreateWidgetInput {
  title?: string;
  theme?: Theme;
  position?: Position;
  isEnabled?: boolean;
  customCss?: string;
}

export type UpdateWidgetInput = Partial<CreateWidgetInput>;

export class WidgetService {
  async getWidgetByBusinessId(businessId: string): Promise<Widget> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const existing = await widgetRepository.findByBusinessId(businessId);
    if (existing) return existing;
    return widgetRepository.createWidget({ businessId });
  }

  async createWidget(businessId: string, data: CreateWidgetInput): Promise<Widget> {
    const business = await businessRepository.findById(businessId);
    if (!business) throw new Error('Business not found');

    const existing = await widgetRepository.findByBusinessId(businessId);
    if (existing) throw new Error('Widget already exists for this business');

    const widget = await widgetRepository.createWidget({
      businessId,
      title: data.title,
      theme: data.theme,
      position: data.position,
      isEnabled: data.isEnabled,
      customCss: data.customCss ?? null,
    });
    await widgetListener.onWidgetCreated(
      new WidgetCreatedEvent(widget.id, businessId),
    );
    return widget;
  }

  async updateWidget(businessId: string, data: UpdateWidgetInput): Promise<Widget> {
    const widget = await widgetRepository.findByBusinessId(businessId);
    if (!widget) throw new Error('Widget not found for business');

    const updated = await widgetRepository.updateWidget(widget.id, {
      title: data.title,
      theme: data.theme,
      position: data.position,
      isEnabled: data.isEnabled,
      customCss: data.customCss === undefined ? undefined : data.customCss,
    });
    await widgetListener.onWidgetUpdated(
      new WidgetUpdatedEvent(updated.id, data),
    );
    return updated;
  }

  async deleteWidget(businessId: string): Promise<Widget> {
    const widget = await widgetRepository.findByBusinessId(businessId);
    if (!widget) throw new Error('Widget not found for business');
    const deleted = await widgetRepository.deleteWidget(widget.id);
    await widgetListener.onWidgetDeleted(new WidgetDeletedEvent(deleted.id));
    return deleted;
  }
}

export const widgetService = new WidgetService();
