import { useSearchParams } from 'react-router-dom';
import { Calculator, BadgePercent, Wrench, Truck, CalendarRange, PackagePlus } from 'lucide-react';
import { PageHeader } from '../components/ui';
import MotorPremium from './calc/MotorPremium';
import NcbTool from './calc/NcbTool';
import ClaimTool from './calc/ClaimTool';
import TpRates from './calc/TpRates';
import LongTerm from './calc/LongTerm';
import Addons from './calc/Addons';
import { cx } from '../lib/utils';

const TOOLS = [
  { id: 'premium', label: 'Motor premium', sub: 'Car and bike estimate', icon: Calculator, Component: MotorPremium },
  { id: 'ncb', label: 'NCB value', sub: 'What the bonus is worth', icon: BadgePercent, Component: NcbTool },
  { id: 'claim', label: 'Claim or not', sub: 'Is a claim worth it', icon: Wrench, Component: ClaimTool },
  { id: 'tp', label: 'Third-party rates', sub: 'All vehicle classes', icon: Truck, Component: TpRates },
  { id: 'longterm', label: 'Long-term plans', sub: 'New car and bike', icon: CalendarRange, Component: LongTerm },
  { id: 'addons', label: 'Add-on prices', sub: 'Zero Dep, RTI and more', icon: PackagePlus, Component: Addons },
];

export default function CalculatorPage() {
  const [params, setParams] = useSearchParams();
  const tool = TOOLS.find((t) => t.id === params.get('tool')) || TOOLS[0];
  const { Component } = tool;

  return (
    <>
      <PageHeader title="Calculators" sub="Quick answers while you are on a call with the customer. Share any result or turn it into a lead or quote." />
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:px-0 2xl:grid-cols-6">
        {TOOLS.map((t) => {
          const active = t.id === tool.id;
          return (
            <button
              key={t.id}
              onClick={() => setParams(t.id === 'premium' ? {} : { tool: t.id }, { replace: true })}
              className={cx(
                'flex min-w-44 shrink-0 items-center gap-3 rounded-2xl border p-3 text-left transition md:min-w-0',
                active ? 'border-brand bg-brand-soft ring-2 ring-brand/15' : 'border-line bg-surface hover:bg-subtle',
              )}
            >
              <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', active ? 'bg-grad text-white' : 'bg-subtle text-brand')}>
                <t.icon className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className={cx('block truncate text-sm font-bold', active ? 'text-brand-strong' : 'text-ink')}>{t.label}</span>
                <span className="block truncate text-[11px] text-mute">{t.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Component key={tool.id} />
    </>
  );
}
