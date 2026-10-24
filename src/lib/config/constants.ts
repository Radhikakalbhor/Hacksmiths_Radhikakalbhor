/**
 * Sahayak Brand & Platform Constants
 */

import { ServiceCategory } from '@/types/jobs';

export const APP_NAME = 'Sahayak';
export const APP_TAGLINE = 'Trusted help. Fair work. Stronger communities.';
export const APP_DESCRIPTION =
  'AI-powered hyperlocal services marketplace connecting homeowners with verified plumbers, electricians, cleaners, painters, and household helpers.';

export interface ServiceCategoryMeta {
  id: ServiceCategory;
  name: string;
  hindiName: string;
  description: string;
  iconName: string;
  popularTasks: string[];
  typicalBenchmarkRangeInr: [number, number];
  typicalDurationEstimate: string;
}

export const SERVICE_CATEGORIES: ServiceCategoryMeta[] = [
  {
    id: 'plumbing',
    name: 'Plumbing',
    hindiName: 'नलसाजी (Plumber)',
    description: 'Pipe leaks, taps, bathroom fittings, flush tanks, water motor repairs.',
    iconName: 'Wrench',
    popularTasks: ['Tap leakage repair', 'Flush valve replacement', 'Drain blockage clearing', 'Geyser fitting'],
    typicalBenchmarkRangeInr: [250, 600],
    typicalDurationEstimate: '1–2 hours',
  },
  {
    id: 'electrical',
    name: 'Electrician',
    hindiName: 'बिजली मिस्त्री (Electrician)',
    description: 'Wiring, MCB tripping, fan installations, switchboards, lighting.',
    iconName: 'Zap',
    popularTasks: ['Ceiling fan installation', 'Switchboard rewiring', 'Short circuit fix', 'MCB upgrade'],
    typicalBenchmarkRangeInr: [200, 550],
    typicalDurationEstimate: '1–2 hours',
  },
  {
    id: 'cleaning',
    name: 'Deep Cleaning',
    hindiName: 'सफाई सेवा (Deep Cleaning)',
    description: 'Full home deep sanitization, kitchen chimney, sofa and bathroom cleaning.',
    iconName: 'Sparkles',
    popularTasks: ['Kitchen degreasing', 'Bathroom descaling', 'Full 2BHK deep clean', 'Sofa shampooing'],
    typicalBenchmarkRangeInr: [800, 2500],
    typicalDurationEstimate: '3–5 hours',
  },
  {
    id: 'painting',
    name: 'Painting & Touchup',
    hindiName: 'रंगाई-पुताई (Painter)',
    description: 'Wall touch-ups, moisture damp proofing, exterior and interior fresh paint.',
    iconName: 'Paintbrush',
    popularTasks: ['Single room touch-up', 'Wall seepage treatment', 'Door/grille polishing', 'Full flat painting'],
    typicalBenchmarkRangeInr: [1200, 5000],
    typicalDurationEstimate: '1–2 days',
  },
  {
    id: 'maid',
    name: 'House Help & Maid',
    hindiName: 'घरेलू सहायिका (House Maid)',
    description: 'Daily sweeping, mopping, utensil washing, clothes laundering, dusting.',
    iconName: 'Home',
    popularTasks: ['Daily sweeping & mopping', 'Utensil washing', 'Emergency one-day helper', 'Deep dust clean'],
    typicalBenchmarkRangeInr: [300, 900],
    typicalDurationEstimate: '2–4 hours',
  },
  {
    id: 'cooking',
    name: 'Cook & Chef',
    hindiName: 'रसोइया (Cook/Chef)',
    description: 'Home-style regional cuisines, party preparations, healthy meal prep.',
    iconName: 'Utensils',
    popularTasks: ['North/South Indian meals', 'Special event party food', 'Weekend meal prep', 'Daily healthy cooking'],
    typicalBenchmarkRangeInr: [400, 1200],
    typicalDurationEstimate: '2–3 hours',
  },
  {
    id: 'carpentry',
    name: 'Carpentry',
    hindiName: 'बढ़ई (Carpenter)',
    description: 'Furniture repairs, door lock fitting, hinge fixes, wardrobe assembly.',
    iconName: 'Hammer',
    popularTasks: ['Door lock installation', 'Hinge repair', 'Modular wardrobe repair', 'Custom shelves'],
    typicalBenchmarkRangeInr: [300, 800],
    typicalDurationEstimate: '1–3 hours',
  },
  {
    id: 'appliance_repair',
    name: 'Appliance Repair',
    hindiName: 'उपकरण मरम्मत (Appliance Repair)',
    description: 'AC servicing, refrigerator cooling, washing machine drum, microwave fixes.',
    iconName: 'Tv',
    popularTasks: ['AC filter deep clean & gas refill', 'Washing machine spin cycle fix', 'Fridge repair', 'RO filter service'],
    typicalBenchmarkRangeInr: [350, 1200],
    typicalDurationEstimate: '1–3 hours',
  },
];

export const OTHER_CUSTOM_CATEGORY: ServiceCategoryMeta = {
  id: 'other',
  name: 'Other / Custom Service',
  hindiName: 'अन्य सेवा (Custom Service)',
  description: 'AC installation, pet bathing, pest control, glasswork, or any unlisted household assistance.',
  iconName: 'HelpCircle',
  popularTasks: ['AC installation & gas charge', 'Pet grooming / bathing', 'Pest control treatment', 'Curtain & blind fitting'],
  typicalBenchmarkRangeInr: [350, 1500],
  typicalDurationEstimate: '1–3 hours',
};

export function getCategoryDurationEstimate(categoryId: string): string {
  const match = SERVICE_CATEGORIES.find((c) => c.id === categoryId);
  if (match) return match.typicalDurationEstimate;
  if (categoryId === 'other') return OTHER_CUSTOM_CATEGORY.typicalDurationEstimate;
  return 'typically 1–3 hours';
}

export const TRUST_PILLARS = [
  {
    title: 'AI Multimodal Posting',
    description: 'Post jobs effortlessly via Hindi/English voice note, photo of the fault, or text. AI parses exact issues and scopes.',
    badge: 'Gemini Powered',
  },
  {
    title: 'Transparent Price Benchmarks',
    description: 'No more arbitrary quotes. Check hyper-local neighborhood price ranges before workers bid competitively.',
    badge: 'Fair Pay Matrix',
  },
  {
    title: 'OTP-Protected Security',
    description: 'Work only commences when customer reveals Start OTP. Final settlement happens after Completion OTP.',
    badge: 'Zero Fraud',
  },
  {
    title: 'Reputation Passport & SOS',
    description: 'Verified worker KYC, skill badges, and 1-tap SOS emergency broadcasts with trusted contacts.',
    badge: 'Verified Safety',
  },
];
