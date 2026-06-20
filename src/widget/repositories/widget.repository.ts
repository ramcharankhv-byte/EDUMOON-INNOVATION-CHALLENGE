import { prisma } from '../../lib/prisma';
import { Widget, Position, Theme } from '@prisma/client';

export class WidgetRepository {
  async findById(id: string): Promise<Widget | null> {
    return prisma.widget.findUnique({ where: { id } });
  }

  async findByBusinessId(businessId: string): Promise<Widget | null> {
    return prisma.widget.findFirst({ where: { businessId } });
  }

  async createWidget(data: {
    businessId: string;
    title?: string;
    theme?: Theme;
    position?: Position;
    isEnabled?: boolean;
    customCss?: string | null;
  }): Promise<Widget> {
    return prisma.widget.create({
      data: {
        businessId: data.businessId,
        title: data.title ?? 'AI Assistant',
        theme: data.theme ?? Theme.LIGHT,
        position: data.position ?? Position.BOTTOM_RIGHT,
        isEnabled: data.isEnabled ?? true,
        customCss: data.customCss ?? null,
      },
    });
  }

  async updateWidget(
    id: string,
    data: Partial<{
      title: string;
      theme: Theme;
      position: Position;
      isEnabled: boolean;
      customCss: string | null;
    }>,
  ): Promise<Widget> {
    return prisma.widget.update({ where: { id }, data });
  }

  async deleteWidget(id: string): Promise<Widget> {
    return prisma.widget.delete({ where: { id } });
  }
}

export const widgetRepository = new WidgetRepository();
