/**
 * Centralized Service Pricing Configuration for Sahayak
 *
 * Provides transparent, configurable baseline rates for all 9 service categories:
 * - Minimum fair visitation / inspection charge
 * - Base labour rate (standard 1-2 hour basic repair/service)
 * - Complexity multipliers (simple, moderate, complex)
 * - Typical material allowances (when spare parts or consumables are involved)
 * - Urgency multipliers (Standard, Same Day, Emergency)
 *
 * NOTE: These are initial sample benchmark parameters that can be reviewed,
 * audited, and updated by local market administrators.
 */

import { ServiceCategory, JobUrgency } from '@/types/jobs';

export type TaskComplexity = 'simple' | 'moderate' | 'complex';

export interface CategoryPricingConfig {
  id: ServiceCategory;
  displayName: string;
  minimumFairChargeInr: number;    // Baseline visit/inspection floor (worker dignity safeguard)
  baseLabourInr: number;           // Standard labour rate for typical routine job
  typicalMaterialsInr: number;     // Typical parts/materials estimate if required
  complexityMultipliers: {
    simple: number;                // e.g. 1.0 (quick fix, minor adjustment)
    moderate: number;              // e.g. 1.35 (standard repair, diagnosis needed)
    complex: number;               // e.g. 1.85 (heavy labor, multiple fixtures, overhaul)
  };
  keywordsSimple: string[];
  keywordsModerate: string[];
  keywordsComplex: string[];
  keywordsMaterialsLikely: string[];
}

export const URGENCY_MULTIPLIERS: Record<JobUrgency, { multiplier: number; label: string; feeNotice: string }> = {
  standard: {
    multiplier: 1.0,
    label: 'Standard',
    feeNotice: 'Standard service pricing (no urgency surcharge)',
  },
  same_day: {
    multiplier: 1.15,
    label: 'Same Day',
    feeNotice: '+15% same-day schedule prioritization',
  },
  urgent: {
    multiplier: 1.15,
    label: 'Urgent',
    feeNotice: '+15% same-day schedule prioritization',
  },
  emergency: {
    multiplier: 1.30,
    label: 'Emergency',
    feeNotice: '+30% emergency priority dispatch (< 2 hrs)',
  },
};

export const SERVICE_PRICING_CONFIGS: Record<ServiceCategory, CategoryPricingConfig> = {
  plumbing: {
    id: 'plumbing',
    displayName: 'Plumbing',
    minimumFairChargeInr: 200,
    baseLabourInr: 300,
    typicalMaterialsInr: 150,
    complexityMultipliers: {
      simple: 1.0,
      moderate: 1.4,
      complex: 2.0,
    },
    keywordsSimple: ['tap', 'washer', 'leak', 'loose', 'tighten', 'showerhead', 'spindle', 'drain clean', 'clog minor'],
    keywordsModerate: ['flush', 'cistern', 'sink replacement', 'pipe leakage', 'mixer', 'angle valve', 'blockage', 'trap'],
    keywordsComplex: ['concealed pipe', 'bathroom renovation', 'sewage line', 'main line', 'water tank', 'overhead tank', 'borewell', 'pipeline install'],
    keywordsMaterialsLikely: ['replace', 'broken', 'new', 'buy', 'parts', 'valve', 'pipe', 'tap', 'spindle', 'washer', 'fitting'],
  },
  electrical: {
    id: 'electrical',
    displayName: 'Electrician',
    minimumFairChargeInr: 200,
    baseLabourInr: 350,
    typicalMaterialsInr: 180,
    complexityMultipliers: {
      simple: 1.0,
      moderate: 1.35,
      complex: 2.1,
    },
    keywordsSimple: ['switch', 'socket', 'fuse', 'bulb', 'holder', 'fan regulator', 'power point', 'bell'],
    keywordsModerate: ['ceiling fan', 'exhaust fan', 'mcb trip', 'short circuit', 'chandelier', 'geyser point', 'inverter connection'],
    keywordsComplex: ['rewiring', 'submeter', 'main panel', 'distribution box', 'three phase', 'phase loss', 'earthing', 'short burning'],
    keywordsMaterialsLikely: ['burnt', 'broken', 'replace', 'new fan', 'wire', 'mcb', 'switchboard', 'socket', 'parts'],
  },
  cleaning: {
    id: 'cleaning',
    displayName: 'Deep Cleaning',
    minimumFairChargeInr: 350,
    baseLabourInr: 500,
    typicalMaterialsInr: 150,
    complexityMultipliers: {
      simple: 1.0,
      moderate: 1.5,
      complex: 2.4,
    },
    keywordsSimple: ['single room', 'balcony', 'bathroom single', 'kitchen counter', 'dusting', 'mop'],
    keywordsModerate: ['1bhk', '2bhk', 'full bathroom', 'kitchen deep clean', 'chimney exterior', 'sofa 3 seater'],
    keywordsComplex: ['3bhk', '4bhk', 'villa', 'post construction', 'move in', 'empty house', 'sofa set 7 seater', 'carpet shampoo'],
    keywordsMaterialsLikely: ['special chemical', 'stain removal', 'acid clean', 'sanitizer', 'shampoo'],
  },
  painting: {
    id: 'painting',
    displayName: 'Painting & Touchup',
    minimumFairChargeInr: 300,
    baseLabourInr: 450,
    typicalMaterialsInr: 250,
    complexityMultipliers: {
      simple: 1.0,
      moderate: 1.6,
      complex: 2.5,
    },
    keywordsSimple: ['touchup', 'nail holes', 'single patch', 'door polish', 'window frame', 'scratch'],
    keywordsModerate: ['single wall', 'accent wall', 'balcony wall', 'putty and primer', 'ceiling touchup', 'water seepage patch'],
    keywordsComplex: ['full room', '1bhk interior', 'waterproofing', 'exterior paint', 'distemper to plastic', 'full apartment repaint'],
    keywordsMaterialsLikely: ['primer', 'putty', 'paint can', 'roller', 'tape', 'brush', 'waterproof chemical', 'stainer'],
  },
  maid: {
    id: 'maid',
    displayName: 'House Help & Maid',
    minimumFairChargeInr: 250,
    baseLabourInr: 350,
    typicalMaterialsInr: 0,
    complexityMultipliers: {
      simple: 1.0,
      moderate: 1.3,
      complex: 1.8,
    },
    keywordsSimple: ['utensils only', 'brooming', 'mopping single room', 'dusting', 'laundry fold'],
    keywordsModerate: ['full house dusting', 'dish washing 4 people', 'clothes washing manual', 'wardrobe organizing'],
    keywordsComplex: ['festival cleaning', 'dinner party cleanup', 'full day help', 'elderly companion', 'deep scrubbing'],
    keywordsMaterialsLikely: [],
  },
  cooking: {
    id: 'cooking',
    displayName: 'Cook & Chef',
    minimumFairChargeInr: 300,
    baseLabourInr: 450,
    typicalMaterialsInr: 0,
    complexityMultipliers: {
      simple: 1.0,
      moderate: 1.4,
      complex: 2.2,
    },
    keywordsSimple: ['one meal', 'dal roti', 'breakfast', 'simple lunch', '1-2 persons', 'sabzi roti'],
    keywordsModerate: ['lunch and dinner', '3-4 persons', 'special dish', 'paneer', 'non-veg', 'biryani prep', 'multi-course'],
    keywordsComplex: ['party cooking', 'guest dinner 8+ persons', 'festival feast', 'caterer style', 'full day chef'],
    keywordsMaterialsLikely: [],
  },
  carpentry: {
    id: 'carpentry',
    displayName: 'Carpentry',
    minimumFairChargeInr: 250,
    baseLabourInr: 400,
    typicalMaterialsInr: 200,
    complexityMultipliers: {
      simple: 1.0,
      moderate: 1.45,
      complex: 2.2,
    },
    keywordsSimple: ['hinge', 'handle', 'lock adjustment', 'tighten screws', 'door stopper', 'cabinet magnet'],
    keywordsModerate: ['new lock install', 'drawer slider', 'curtain rod', 'shelf mounting', 'door realignment', 'mesh fix'],
    keywordsComplex: ['wardrobe repair', 'bed assembly', 'modular kitchen hinge overhaul', 'custom wooden cabinet', 'pest damaged wood replacement'],
    keywordsMaterialsLikely: ['hinge', 'screws', 'lock set', 'handle', 'adhesive', 'fevicol', 'wood piece', 'slider channel', 'brackets'],
  },
  appliance_repair: {
    id: 'appliance_repair',
    displayName: 'Appliance Repair',
    minimumFairChargeInr: 250,
    baseLabourInr: 450,
    typicalMaterialsInr: 300,
    complexityMultipliers: {
      simple: 1.0,
      moderate: 1.4,
      complex: 2.3,
    },
    keywordsSimple: ['filter clean', 'gas stove flame check', 'ro water filter change', 'iron thermostat check', 'microwave turntable'],
    keywordsModerate: ['washing machine draining error', 'refrigerator cooling low', 'geyser thermostat', 'water purifier membrane', 'chimney servicing'],
    keywordsComplex: ['compressor replacement', 'pcb board repair', 'drum bearing replacement', 'gas charging', 'inverter ac pcb overhaul'],
    keywordsMaterialsLikely: ['capacitor', 'filter', 'thermostat', 'sensor', 'pcb', 'gas', 'coil', 'valve', 'pipe', 'motor', 'belt'],
  },
  other: {
    id: 'other',
    displayName: 'Other / Custom Service',
    minimumFairChargeInr: 200,
    baseLabourInr: 350,
    typicalMaterialsInr: 150,
    complexityMultipliers: {
      simple: 1.0,
      moderate: 1.35,
      complex: 1.9,
    },
    keywordsSimple: ['quick help', 'inspection', 'minor fix', 'tighten', 'adjust', 'small task'],
    keywordsModerate: ['installation', 'servicing', 'replacement', 'repair', 'reinstallation'],
    keywordsComplex: ['renovation', 'complete overhaul', 'custom fabrication', 'heavy duty', 'multi-day', 'major issue'],
    keywordsMaterialsLikely: ['replace', 'new', 'spare', 'parts', 'material'],
  },
};

/**
 * Returns the pricing configuration for a service category, with safe fallback to 'other'.
 */
export function getCategoryPricingConfig(category: string): CategoryPricingConfig {
  const norm = category.toLowerCase().trim() as ServiceCategory;
  return SERVICE_PRICING_CONFIGS[norm] || SERVICE_PRICING_CONFIGS.other;
}

