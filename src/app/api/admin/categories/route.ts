import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { logAdminAction } from '@/lib/services/admin.service';
import { apiSuccess, apiError } from '@/lib/api/response';

// In-memory or platform category config state
const DEFAULT_CATEGORIES = [
  {
    id: 'cat-plumbing',
    code: 'plumbing',
    name: 'Plumbing & Sanitary',
    iconName: 'Wrench',
    isEnabled: true,
    supportedCities: ['Mumbai', 'Delhi NCR', 'Bengaluru', 'Pune'],
    supportedPincodes: ['400050', '400028', '400069', '400070', '400076'],
    defaultRadiusKm: 15,
  },
  {
    id: 'cat-electrical',
    code: 'electrical',
    name: 'Electrical & Wiring',
    iconName: 'Zap',
    isEnabled: true,
    supportedCities: ['Mumbai', 'Delhi NCR', 'Bengaluru', 'Pune'],
    supportedPincodes: ['400050', '400028', '400069', '400070'],
    defaultRadiusKm: 12,
  },
  {
    id: 'cat-cleaning',
    code: 'cleaning',
    name: 'Home & Kitchen Cleaning',
    iconName: 'Sparkles',
    isEnabled: true,
    supportedCities: ['Mumbai', 'Delhi NCR'],
    supportedPincodes: ['400050', '400069'],
    defaultRadiusKm: 10,
  },
  {
    id: 'cat-painting',
    code: 'painting',
    name: 'Painting & Waterproofing',
    iconName: 'Paintbrush',
    isEnabled: true,
    supportedCities: ['Mumbai', 'Delhi NCR'],
    supportedPincodes: ['400050', '400028'],
    defaultRadiusKm: 20,
  },
  {
    id: 'cat-carpentry',
    code: 'carpentry',
    name: 'Carpentry & Furniture Repair',
    iconName: 'Hammer',
    isEnabled: true,
    supportedCities: ['Mumbai', 'Bengaluru'],
    supportedPincodes: ['400050', '400076'],
    defaultRadiusKm: 15,
  },
  {
    id: 'cat-appliance',
    code: 'appliance_repair',
    name: 'Appliance & AC Repair',
    iconName: 'Cpu',
    isEnabled: true,
    supportedCities: ['Mumbai', 'Delhi NCR', 'Bengaluru', 'Pune'],
    supportedPincodes: ['400050', '400028', '400069', '400076'],
    defaultRadiusKm: 12,
  },
];

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  return apiSuccess(DEFAULT_CATEGORIES);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { categoryCode, isEnabled, defaultRadiusKm, supportedCities } = body;

    const target = DEFAULT_CATEGORIES.find((c) => c.code === categoryCode);
    if (!target) {
      return apiError('Category not found', 404, 'NOT_FOUND');
    }

    if (typeof isEnabled === 'boolean') target.isEnabled = isEnabled;
    if (typeof defaultRadiusKm === 'number') target.defaultRadiusKm = defaultRadiusKm;
    if (Array.isArray(supportedCities)) target.supportedCities = supportedCities;

    await logAdminAction({
      adminId: auth.admin.userId,
      action: 'CATEGORY_CONFIG_UPDATE',
      entityType: 'CATEGORY',
      entityId: categoryCode,
      metadata: { isEnabled, defaultRadiusKm, supportedCities },
    });

    return apiSuccess(target);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Category update failed';
    return apiError(msg, 500, 'SERVER_ERROR');
  }
}

