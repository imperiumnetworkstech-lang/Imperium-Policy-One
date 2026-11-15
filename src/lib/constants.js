import { addDays, addYears, daysUntil, todayISO } from './utils';

export const APP_NAME = 'Imperium PolicyOne';

export const CATEGORIES = [
  { id: 'motor', label: 'Motor', color: '#7445d1' },
  { id: 'health', label: 'Health', color: '#f03ccb' },
  { id: 'life', label: 'Life', color: '#7f8cf8' },
  { id: 'non_motor', label: 'Non-Motor', color: '#d97706' },
];
export const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;
export const catColor = (id) => CATEGORIES.find((c) => c.id === id)?.color || '#64748b';

export const INSURERS = [
  'Acko General', 'Aditya Birla Health', 'Aditya Birla Sun Life', 'Axis Max Life', 'Bajaj Allianz General',
  'Bajaj Allianz Life', 'Care Health', 'Cholamandalam MS', 'Digit General', 'Future Generali',
  'HDFC ERGO', 'HDFC Life', 'ICICI Lombard', 'ICICI Prudential Life', 'IFFCO Tokio', 'Kotak General',
  'Kotak Life', 'Liberty General', 'LIC of India', 'Magma General', 'ManipalCigna Health',
  'National Insurance', 'New India Assurance', 'Niva Bupa Health', 'Oriental Insurance', 'Reliance General',
  'Royal Sundaram', 'SBI General', 'SBI Life', 'Shriram General', 'Star Health', 'Tata AIA Life',
  'Tata AIG General', 'United India Insurance', 'Universal Sompo', 'Zuno General',
];

export const NCB_SLABS = [0, 20, 25, 35, 45, 50];
export const nextNcb = (current) => {
  const i = NCB_SLABS.indexOf(Number(current) || 0);
  return NCB_SLABS[Math.min(i < 0 ? 1 : i + 1, NCB_SLABS.length - 1)];
};

export const MOTOR_ADDONS = [
  'Zero Depreciation', 'Engine Protect', 'Roadside Assistance', 'Return to Invoice', 'Consumables',
  'Key Replacement', 'Tyre Protect', 'NCB Protect', 'Personal Belongings', 'Passenger Cover',
];

const isTP = (f) => f.coverType === 'Third Party';

// Category specific field definitions. The policy form and the detail view both render from this.
export const FIELDS = {
  motor: [
    { name: 'vehicleClass', label: 'Vehicle class', type: 'select', options: ['Private Car', 'Two Wheeler', 'Goods Carrying (GCV)', 'Passenger Carrying (PCV)', 'Miscellaneous / Tractor'] },
    { name: 'coverType', label: 'Cover type', type: 'select', options: ['Comprehensive', 'Third Party', 'Standalone OD'] },
    { name: 'regNo', label: 'Vehicle number', type: 'text', upper: true, placeholder: 'MH12AB1234' },
    { name: 'make', label: 'Make', type: 'text', placeholder: 'Maruti Suzuki' },
    { name: 'model', label: 'Model / variant', type: 'text', placeholder: 'Swift VXI' },
    { name: 'fuel', label: 'Fuel', type: 'select', options: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'LPG'] },
    { name: 'mfgYear', label: 'Manufacturing year', type: 'number', placeholder: '2022' },
    { name: 'regDate', label: 'Registration date', type: 'date' },
    { name: 'cc', label: 'Cubic capacity (cc)', type: 'number', placeholder: '1197' },
    { name: 'engineNo', label: 'Engine number', type: 'text', upper: true },
    { name: 'chassisNo', label: 'Chassis number', type: 'text', upper: true },
    { name: 'idv', label: 'IDV', type: 'number', money: true, hide: isTP },
    { name: 'ncb', label: 'NCB %', type: 'select', options: NCB_SLABS.map(String), hide: isTP },
    { name: 'claimMade', label: 'Claim in this policy period', type: 'select', options: ['No', 'Yes'], hint: 'Decides NCB at next renewal' },
    { name: 'financer', label: 'Hypothecation / financer', type: 'text', placeholder: 'HDFC Bank' },
    { name: 'pucExpiry', label: 'PUC expiry', type: 'date' },
    { name: 'prevInsurer', label: 'Previous insurer', type: 'text' },
    { name: 'prevPolicyNo', label: 'Previous policy number', type: 'text' },
    { name: 'addons', label: 'Add-on covers', type: 'chips', options: MOTOR_ADDONS, hide: isTP, full: true },
  ],
  health: [
    { name: 'planType', label: 'Plan type', type: 'select', options: ['Individual', 'Family Floater', 'Senior Citizen', 'Top-up / Super Top-up', 'Critical Illness', 'Personal Accident', 'Group Health'] },
    { name: 'sumInsured', label: 'Sum insured', type: 'number', money: true },
    { name: 'membersCount', label: 'Members covered', type: 'number', placeholder: '4' },
    { name: 'members', label: 'Member names', type: 'text', placeholder: 'Self, spouse, 2 kids' },
    { name: 'eldestDob', label: 'Eldest member date of birth', type: 'date' },
    { name: 'ped', label: 'Pre-existing diseases', type: 'text', placeholder: 'Diabetes, hypertension or None' },
    { name: 'cumulativeBonus', label: 'Cumulative bonus %', type: 'number' },
    { name: 'tenure', label: 'Policy tenure (years)', type: 'select', options: ['1', '2', '3'] },
    { name: 'ported', label: 'Ported from another insurer', type: 'select', options: ['No', 'Yes'] },
    { name: 'nominee', label: 'Nominee', type: 'text' },
  ],
  life: [
    { name: 'planType', label: 'Plan type', type: 'select', options: ['Term', 'Endowment', 'ULIP', 'Money Back', 'Whole Life', 'Pension / Annuity', 'Child Plan'] },
    { name: 'sumInsured', label: 'Sum assured', type: 'number', money: true },
    { name: 'policyTerm', label: 'Policy term (years)', type: 'number' },
    { name: 'payingTerm', label: 'Premium paying term (years)', type: 'number' },
    { name: 'frequency', label: 'Premium frequency', type: 'select', options: ['Yearly', 'Half-yearly', 'Quarterly', 'Monthly', 'Single'] },
    { name: 'maturityDate', label: 'Maturity date', type: 'date' },
    { name: 'lifeAssuredDob', label: 'Life assured date of birth', type: 'date' },
    { name: 'nominee', label: 'Nominee', type: 'text' },
  ],
  non_motor: [
    { name: 'planType', label: 'Line of business', type: 'select', options: ['Fire', 'Burglary', 'Shop / Office Package', 'Home', 'Marine Cargo', 'Travel', 'Workmen Compensation', 'Liability', 'Cyber', 'Engineering', 'Personal Accident', 'Other'] },
    { name: 'sumInsured', label: 'Sum insured', type: 'number', money: true },
    { name: 'riskLocation', label: 'Risk location', type: 'text', placeholder: 'Address of the insured property' },
    { name: 'occupancy', label: 'Occupancy / business', type: 'text', placeholder: 'Garment shop' },
    { name: 'riskDetails', label: 'Risk details', type: 'textarea', full: true, placeholder: 'Stock value, employees covered, travel destination...' },
  ],
};

// Individual health and life policies have been GST exempt since 22 Sep 2025; motor and other general lines carry 18%.
export const defaultGst = (category) => (category === 'health' || category === 'life' ? 0 : 18);

export const blankPolicy = (category = 'motor') => {
  const start = todayISO();
  return {
    category,
    businessType: 'New',
    clientId: '',
    insurer: '',
    policyNumber: '',
    product: '',
    startDate: start,
    endDate: addDays(addYears(start, 1), -1),
    issueDate: start,
    netPremium: '',
    odPremium: '',
    tpPremium: '',
    gstRate: defaultGst(category),
    commissionRate: '',
    commissionBase: 'net',
    commissionAmount: '',
    commissionStatus: 'Pending',
    paymentMode: 'Online',
    notes: '',
    docLink: '',
    ...(category === 'motor'
      ? { vehicleClass: 'Private Car', coverType: 'Comprehensive', ncb: '0', claimMade: 'No', fuel: 'Petrol', addons: [] }
      : {}),
    ...(category === 'health' ? { planType: 'Family Floater', tenure: '1', ported: 'No' } : {}),
    ...(category === 'life' ? { planType: 'Term', frequency: 'Yearly' } : {}),
    ...(category === 'non_motor' ? { planType: 'Fire' } : {}),
  };
};

/* ---------- derived policy state ---------- */
export const saleDate = (p) => p.issueDate || p.startDate || '';
export const totalPremium = (p) => Number(p.totalPremium) || Number(p.netPremium) || 0;

export function policyStatus(p) {
  if (p.status === 'cancelled') return 'cancelled';
  if (p.renewalStatus === 'renewed') return 'renewed';
  if (p.renewalStatus === 'lost') return 'lost';
  const d = daysUntil(p.endDate);
  if (d == null) return 'active';
  if (d < 0) return 'expired';
  if (d <= 30) return 'due';
  return 'active';
}
export const STATUS_META = {
  active: { label: 'Active', tone: 'green' },
  due: { label: 'Renewal due', tone: 'amber' },
  expired: { label: 'Expired', tone: 'red' },
  renewed: { label: 'Renewed', tone: 'blue' },
  lost: { label: 'Lost', tone: 'gray' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
};
// In force today: counts towards the live book.
export const isLive = (p) => ['active', 'due'].includes(policyStatus(p));
// Needs a renewal decision: not yet renewed / lost / cancelled.
export const isRenewable = (p) => ['active', 'due', 'expired'].includes(policyStatus(p));

export const policyTitle = (p) => {
  if (p.category === 'motor') return [p.make, p.model].filter(Boolean).join(' ') || p.regNo || 'Motor policy';
  return p.product || p.planType || catLabel(p.category);
};
export const policySub = (p) => {
  if (p.category === 'motor') return [p.regNo, p.coverType].filter(Boolean).join(' · ');
  return [p.planType, p.policyNumber].filter(Boolean).join(' · ');
};

export const LEAD_STAGES = [
  { id: 'new', label: 'New', tone: 'blue' },
  { id: 'contacted', label: 'Contacted', tone: 'violet' },
  { id: 'quoted', label: 'Quoted', tone: 'amber' },
  { id: 'won', label: 'Won', tone: 'green' },
  { id: 'lost', label: 'Lost', tone: 'gray' },
];
export const LEAD_SOURCES = ['Referral', 'Existing client', 'Walk-in', 'Social media', 'Website', 'Cold call', 'Dealer / garage', 'Other'];

export const CLAIM_STATUSES = [
  { id: 'intimated', label: 'Intimated', tone: 'blue' },
  { id: 'documents', label: 'Documents pending', tone: 'amber' },
  { id: 'survey', label: 'Survey / processing', tone: 'violet' },
  { id: 'approved', label: 'Approved', tone: 'green' },
  { id: 'settled', label: 'Settled', tone: 'green' },
  { id: 'rejected', label: 'Rejected', tone: 'red' },
];
