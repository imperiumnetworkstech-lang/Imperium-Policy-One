import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Upload, Download, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Badge, Button, Field, Modal, Select, useToast } from './ui';
import { CATEGORIES, catLabel } from '../lib/constants';
import { IMPORT_FIELDS, autoMap, buildImport, downloadTemplate, readSpreadsheet } from '../lib/importBook';
import { cx, fmtDate, inr } from '../lib/utils';

const GROUPS = ['Client', 'Policy', 'Motor', 'Premium'];

export default function ImportBook({ onClose }) {
  const { clients, policies, newId, bulkAdd } = useData();
  const toast = useToast();
  const input = useRef(null);
  const [step, setStep] = useState('upload'); // upload | map | done
  const [sheet, setSheet] = useState(null);
  const [mapping, setMapping] = useState([]);
  const [defaultCategory, setDefaultCategory] = useState('motor');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);

  async function open(file) {
    if (!file) return;
    setError('');
    setReading(true);
    try {
      const s = await readSpreadsheet(file);
      if (!s.data.length) throw new Error('The sheet has headings but no rows below them.');
      setSheet({ ...s, file: file.name });
      setMapping(autoMap(s.headers));
      setStep('map');
    } catch (e) {
      setError(e.message || 'Could not read this file.');
    } finally {
      setReading(false);
    }
  }

  const plan = useMemo(
    () => (sheet ? buildImport({ data: sheet.data, mapping, defaultCategory, clients, policies }) : null),
    [sheet, mapping, defaultCategory, clients, policies],
  );
  const hasName = mapping.includes('name');

  function runImport() {
    const ids = new Map();
    const items = [];
    plan.clients.forEach((c) => {
      const id = newId('clients');
      ids.set(c.tempKey, id);
      const { tempKey, ...data } = c;
      items.push({ col: 'clients', id, data });
    });
    plan.policies.forEach((p) => {
      const { clientRef, ...data } = p;
      items.push({ col: 'policies', id: newId('policies'), data: { ...data, clientId: clientRef.existingId || ids.get(clientRef.tempKey) } });
    });
    bulkAdd(items);
    setResult({ clients: plan.clients.length, policies: plan.policies.length, skipped: plan.skipped.length });
    setStep('done');
    toast(`Imported ${plan.policies.length} policies`);
  }

  const setCol = (i, key) => setMapping((m) => m.map((k, j) => (j === i ? key : k === key && key ? '' : k)));

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Import from Excel"
      sub={step === 'map' ? `${sheet.file} · ${sheet.data.length} rows` : 'Bring your existing book in one go.'}
      footer={
        step === 'map' ? (
          <>
            <Button variant="ghost" icon={ArrowLeft} className="mr-auto" onClick={() => setStep('upload')}>Choose another file</Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button icon={Upload} disabled={!hasName || !(plan.clients.length + plan.policies.length)} onClick={runImport}>
              Import {plan.policies.length} {plan.policies.length === 1 ? 'policy' : 'policies'}
            </Button>
          </>
        ) : step === 'done' ? (
          <Button onClick={onClose}>Done</Button>
        ) : null
      }
    >
      {step === 'upload' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => input.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); open(e.dataTransfer.files?.[0]); }}
            className={cx('flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition', dragging ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand/60 hover:bg-subtle')}
          >
            <span className="bg-grad mb-4 grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-fuchsia-500/25">
              {reading ? <Loader2 className="size-6 animate-spin" /> : <FileSpreadsheet className="size-6" />}
            </span>
            <span className="text-sm font-bold text-ink">{reading ? 'Reading your sheet...' : 'Drop your Excel or CSV file here, or tap to choose'}</span>
            <span className="mt-1 max-w-md text-xs text-mute">One row per policy. Your column names do not need to match ours; you can match them on the next step.</span>
          </button>
          <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => { open(e.target.files?.[0]); e.target.value = ''; }} />
          {error && <p className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-subtle p-4">
            <div className="text-xs text-mute">
              <p className="font-bold text-ink">Starting from scratch?</p>
              Download the template, fill it in Excel, and upload it here.
            </div>
            <Button variant="secondary" size="sm" icon={Download} onClick={downloadTemplate}>Download template</Button>
          </div>
          <ul className="space-y-1 text-xs text-mute">
            <li>Dates can be 15/11/2026, 15-Nov-2026 or Excel dates. Amounts can include commas or Rs.</li>
            <li>Clients are matched to existing ones by mobile number or exact name, so nobody is duplicated.</li>
            <li>Policies whose policy number already exists are skipped.</li>
          </ul>
        </div>
      )}

      {step === 'map' && plan && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            {[['New clients', plan.clients.length], ['Matched clients', plan.matchedClients], ['Policies to add', plan.policies.length], ['Rows skipped', plan.skipped.length]].map(([l, v]) => (
              <div key={l} className="bg-surface px-4 py-3">
                <p className="text-[11px] font-semibold text-mute">{l}</p>
                <p className="tnum text-lg font-bold text-ink">{v}</p>
              </div>
            ))}
          </div>

          {!hasName && <p className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">Choose which column holds the customer name to continue.</p>}

          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <div>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">Match your columns</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {sheet.headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-line p-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink" title={h}>{h || `Column ${i + 1}`}</span>
                    <select value={mapping[i] || ''} onChange={(e) => setCol(i, e.target.value)} className={cx('h-8 w-40 rounded-lg border px-2 text-xs', mapping[i] ? 'border-brand/40 bg-brand-soft text-brand-strong' : 'border-line bg-surface text-mute')}>
                      <option value="">Do not import</option>
                      {GROUPS.map((g) => (
                        <optgroup key={g} label={g}>
                          {IMPORT_FIELDS.filter((f) => f.group === g).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <Field label="If a row has no insurance type, treat it as">
              <Select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </Field>
          </div>

          <div>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">Preview (first 5 policies)</h3>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-subtle text-faint">
                    {['Customer', 'Type', 'Insurer', 'Policy no.', 'Vehicle / plan', 'Expiry', 'Net premium', 'Commission'].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {plan.policies.slice(0, 5).map((p, i) => {
                    const who = p.clientRef.existingId ? clients.find((c) => c.id === p.clientRef.existingId)?.name : plan.clients.find((c) => c.tempKey === p.clientRef.tempKey)?.name;
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2 font-semibold text-ink">{who}{p.clientRef.existingId && <Badge tone="blue" className="ml-1.5">existing</Badge>}</td>
                        <td className="px-3 py-2">{catLabel(p.category)}</td>
                        <td className="px-3 py-2">{p.insurer || '-'}</td>
                        <td className="px-3 py-2">{p.policyNumber || '-'}</td>
                        <td className="px-3 py-2">{p.regNo || [p.make, p.model].filter(Boolean).join(' ') || p.product || '-'}</td>
                        <td className="px-3 py-2">{fmtDate(p.endDate)}</td>
                        <td className="tnum px-3 py-2">{inr(p.netPremium)}</td>
                        <td className="tnum px-3 py-2">{inr(p.commissionAmount)}</td>
                      </tr>
                    );
                  })}
                  {!plan.policies.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-mute">No policies found yet. Check the column matches above.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {plan.skipped.length > 0 && (
            <details className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-xs">
              <summary className="font-bold text-amber-700 dark:text-amber-300">{plan.skipped.length} {plan.skipped.length === 1 ? 'row' : 'rows'} will be skipped</summary>
              <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-mute">
                {plan.skipped.map((s, i) => <li key={i}>Row {s.line}: {s.reason}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="size-7" /></span>
          <p className="text-lg font-bold text-ink">Import complete</p>
          <p className="mt-1 text-sm text-mute">
            Added {result.policies} {result.policies === 1 ? 'policy' : 'policies'} and {result.clients} new {result.clients === 1 ? 'client' : 'clients'}{result.skipped ? `, skipped ${result.skipped} ${result.skipped === 1 ? 'row' : 'rows'}` : ''}.
          </p>
          <p className="mt-3 max-w-sm text-xs text-faint">Renewals, commission totals and insights now include the imported policies.</p>
        </div>
      )}
    </Modal>
  );
}
