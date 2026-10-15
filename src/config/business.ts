import type { BusinessSettings, ServiceItem } from '@/types';
import { DEFAULT_NOTIFICATION_TEMPLATES } from './orderStatus';

/**
 * Default business configuration. Everything here can be changed by staff in
 * Admin → Settings; these values only seed a fresh install / database.
 *
 * Contact details come from Suzy's Cleaners' Burbank Chamber of Commerce
 * listing. Verify phone & hours before launch.
 */
export const STORE_ORIGIN = { latitude: 34.1867, longitude: -118.3089 }; // 540 N Glenoaks Blvd

export const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "Suzy's Cleaners",
  tagline: 'Best Quality Dry Cleaners in Burbank',
  phone: '(747) 333-0034',
  altPhone: '(463) 583-0000',
  email: 'suzyscleaners@sbcglobal.net',
  website: 'https://suzyscleaners.com',
  serviceRadiusMiles: 20,
  timeWindows: ['9–11 AM', '12–2 PM', '3–5 PM'],
  bookingDaysAhead: 7,
  hours: [
    { day: 'Mon', open: '7:00 AM', close: '7:00 PM', closed: false },
    { day: 'Tue', open: '7:00 AM', close: '7:00 PM', closed: false },
    { day: 'Wed', open: '7:00 AM', close: '7:00 PM', closed: false },
    { day: 'Thu', open: '7:00 AM', close: '7:00 PM', closed: false },
    { day: 'Fri', open: '7:00 AM', close: '7:00 PM', closed: false },
    { day: 'Sat', open: '8:00 AM', close: '5:00 PM', closed: false },
    { day: 'Sun', open: '8:00 AM', close: '5:00 PM', closed: false },
  ],
  locations: [
    {
      id: 'loc-burbank',
      name: 'Burbank',
      address: '540 N Glenoaks Blvd',
      city: 'Burbank',
      state: 'CA',
      zip: '91502',
      phone: '(747) 333-0034',
      latitude: STORE_ORIGIN.latitude,
      longitude: STORE_ORIGIN.longitude,
      status: 'open',
    },
    {
      id: 'loc-pasadena',
      name: 'Pasadena',
      address: '',
      city: 'Pasadena',
      state: 'CA',
      zip: '',
      phone: '',
      latitude: 34.1478,
      longitude: -118.1445,
      status: 'coming_soon',
    },
    {
      id: 'loc-northridge',
      name: 'Northridge',
      address: '',
      city: 'Northridge',
      state: 'CA',
      zip: '',
      phone: '',
      latitude: 34.2283,
      longitude: -118.5368,
      status: 'coming_soon',
    },
  ],
  notificationTemplates: DEFAULT_NOTIFICATION_TEMPLATES,
  about:
    "Since 1996, Suzy's Cleaners has been Burbank's trusted, family-owned garment care studio. " +
    'Every piece is inspected by hand, cleaned with certified, eco-friendly methods and finished with the kind of care ' +
    'you would give it yourself — from everyday shirts to bridal gowns, designer suits and luxury sneakers. ' +
    'Our concierge pickup and delivery brings that same attention to your door.',
  chamberMember: true,
};

export const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: 'dry-cleaning',
    name: 'Dry Cleaning',
    tagline: 'Precision cleaning, hand-finished',
    description:
      'Suits, dresses, silks and delicates cleaned with gentle, certified solvents, then hand-pressed and inspected button by button.',
    highlights: ['Hand-finished pressing', 'Stain treatment included', 'Eco-friendly options'],
    icon: 'hanger',
    image: 'dry-cleaning',
    active: true,
    bookable: true,
    sortOrder: 1,
  },
  {
    id: 'garment-care',
    name: 'Garment Care',
    tagline: 'Bridal, couture & heirlooms',
    description:
      'Specialty care for wedding gowns, couture, leather, suede and heirloom pieces — including preservation boxing.',
    highlights: ['Gown cleaning & preservation', 'Leather & suede', 'Wash & fold laundry'],
    icon: 'tshirt-crew-outline',
    image: 'garment-care',
    active: true,
    bookable: true,
    sortOrder: 2,
  },
  {
    id: 'shoe-cleaning',
    name: 'Luxury Shoe Cleaning',
    tagline: 'Sneakers, loafers & heels restored',
    description:
      'Deep cleaning, deodorizing and conditioning for designer sneakers, leather dress shoes and heels.',
    highlights: ['Leather conditioning', 'Sole whitening', 'Deodorizing'],
    icon: 'shoe-sneaker',
    image: 'shoe-cleaning',
    active: true,
    bookable: true,
    sortOrder: 3,
  },
  {
    id: 'tailoring',
    name: 'Tailoring & Alterations',
    tagline: 'A perfect fit, every time',
    description:
      'Hems, tapering, sleeves, zippers and full re-fits by our in-house tailor. Fittings available by appointment.',
    highlights: ['Hems & tapering', 'Zipper & button repair', 'Formalwear fittings'],
    icon: 'content-cut',
    image: 'tailoring',
    active: true,
    bookable: true,
    sortOrder: 4,
  },
  {
    id: 'pickup-delivery',
    name: 'Pickup & Delivery',
    tagline: 'Concierge service at your door',
    description:
      'We collect from your home or office and return everything fresh, pressed and on hangers. Pickups require at least 10 pieces.',
    highlights: ['10-piece pickup minimum', 'Next-day turnaround on request', 'Contact-free drop-off'],
    icon: 'truck-delivery-outline',
    image: 'pickup-delivery',
    active: true,
    bookable: false,
    sortOrder: 5,
  },
];

export const TRUST_BADGES = ['Since 1996', 'Certified Cleaning', 'Eco-Friendly Options', 'Local Family Business'];
