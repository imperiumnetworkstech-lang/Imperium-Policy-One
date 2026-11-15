import { useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, Save, Trash2, Phone, Mail, Globe, MapPin, ShieldCheck, PanelLeft, PanelRight } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Button, Card, CardHead, Field, Input, PageHeader, Segmented, useToast } from '../components/ui';
import { cx } from '../lib/utils';

const W = 1050; // 3.5 x 2 inch card at 300 dpi
const H = 600;
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

const THEMES = {
  gradient: { label: 'Imperium gradient', bg: 'grad', text: '#ffffff', sub: '#ffe3f7', accent: '#ffd1f3', panel: 'rgba(255,255,255,0.14)', backBg: 'grad', backText: '#ffffff', backSub: '#ffe3f7' },
  white: { label: 'Clean white', bg: '#ffffff', text: '#0b0b12', sub: '#4a4a5a', accent: '#7445d1', panel: 'grad', backBg: 'grad', backText: '#ffffff', backSub: '#ffe3f7' },
  dark: { label: 'Midnight', bg: '#0b0b12', text: '#ffffff', sub: '#c3b3ff', accent: '#ff4fd8', panel: '#1b1530', backBg: '#0b0b12', backText: '#ffffff', backSub: '#c4b5fd' },
};

// Shrinks the font so a single line always fits its box.
const fit = (text, max, width) => Math.min(max, Math.floor(width / (Math.max(String(text || '').length, 1) * 0.56)));

function Defs({ id }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#c2188f" />
        <stop offset="0.5" stopColor="#7445d1" />
        <stop offset="1" stopColor="#4f5bd5" />
      </linearGradient>
    </defs>
  );
}

function LogoTile({ logo, cx: x, y, size }) {
  const pad = size * 0.1;
  return (
    <g>
      <rect x={x - size / 2} y={y} width={size} height={size} rx={size * 0.18} fill="#ffffff" />
      {logo ? (
        <image href={logo} x={x - size / 2 + pad} y={y + pad} width={size - pad * 2} height={size - pad * 2} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <ShieldCheck x={x - size * 0.28} y={y + size * 0.22} width={size * 0.56} height={size * 0.56} color="#7445d1" strokeWidth={1.6} />
      )}
    </g>
  );
}

function Front({ d, svgRef }) {
  const t = THEMES[d.theme] || THEMES.gradient;
  const fill = (v) => (v === 'grad' ? 'url(#cardGradFront)' : v);
  const left = d.logoSide !== 'right';
  const panelX = left ? 0 : W - 330;
  const pcx = panelX + 165;
  const x0 = left ? 390 : 60;
  const rows = [[Phone, d.phone], [Mail, d.email], [Globe, d.website], [MapPin, d.address]].filter(([, v]) => v).slice(0, 4);
  const rowsY = 296;

  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} fontFamily={FONT} className="block w-full">
      <Defs id="cardGradFront" />
      <rect width={W} height={H} fill={fill(t.bg)} />
      <rect x={panelX} width="330" height={H} fill={fill(t.panel)} />
      <LogoTile logo={d.logo} cx={pcx} y={d.tagline ? 130 : 150} size={180} />
      <text x={pcx} y={d.tagline ? 368 : 388} textAnchor="middle" fill="#ffffff" fontWeight="700" fontSize={fit(d.agency, 30, 290)}>{d.agency}</text>
      {d.tagline && <text x={pcx} y="404" textAnchor="middle" fill="#ede9fe" fontSize={fit(d.tagline, 18, 290)}>{d.tagline}</text>}

      <text x={x0} y="150" fill={t.text} fontWeight="800" fontSize={fit(d.name, 58, 600)}>{d.name}</text>
      <text x={x0} y="196" fill={t.sub} fontSize={fit(d.title, 26, 600)}>{d.title}</text>
      <rect x={x0} y="222" width="72" height="6" rx="3" fill={t.accent} />

      {rows.map(([Icon, value], i) => (
        <g key={i}>
          <Icon x={x0} y={rowsY + i * 50 - 22} width="26" height="26" color={t.accent} strokeWidth={2} />
          <text x={x0 + 44} y={rowsY + i * 50} fill={t.text} fontSize={fit(value, 25, 555)}>{value}</text>
        </g>
      ))}
      {d.licence && <text x={x0} y="558" fill={t.sub} fontSize={fit(d.licence, 17, 600)}>{d.licence}</text>}
    </svg>
  );
}

function Back({ d, svgRef }) {
  const t = THEMES[d.theme] || THEMES.gradient;
  const fill = (v) => (v === 'grad' ? 'url(#cardGradBack)' : v);
  const services = (d.services || '').split(',').map((s) => s.trim()).filter(Boolean).join('   |   ');
  const foot = [d.website, d.phone].filter(Boolean).join('   |   ');
  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} fontFamily={FONT} className="block w-full">
      <Defs id="cardGradBack" />
      <rect width={W} height={H} fill={fill(t.backBg)} />
      <circle cx="930" cy="80" r="220" fill="#ffffff" opacity="0.06" />
      <circle cx="90" cy="560" r="170" fill="#ffffff" opacity="0.05" />
      <LogoTile logo={d.logo} cx={W / 2} y={70} size={190} />
      <text x={W / 2} y="340" textAnchor="middle" fill={t.backText} fontWeight="800" fontSize={fit(d.agency, 52, 940)}>{d.agency}</text>
      {d.tagline && <text x={W / 2} y="384" textAnchor="middle" fill={t.backSub} fontSize={fit(d.tagline, 25, 900)}>{d.tagline}</text>}
      <rect x={W / 2 - 36} y="412" width="72" height="5" rx="2.5" fill={t.backSub} />
      {services && <text x={W / 2} y="468" textAnchor="middle" fill={t.backText} fontWeight="600" fontSize={fit(services, 24, 1500)}>{services}</text>}
      {foot && <text x={W / 2} y="548" textAnchor="middle" fill={t.backSub} fontSize={fit(foot, 20, 900)}>{foot}</text>}
    </svg>
  );
}

async function downloadPng(svgEl, filename) {
  const xml = new XMLSerializer().serializeToString(svgEl);
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  });
  const canvas = document.createElement('canvas');
  canvas.width = W * 2; // 600 dpi for print
  canvas.height = H * 2;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Downscale the uploaded logo so it stores comfortably inside the profile document.
function readLogo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, 400 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function BusinessCard() {
  const { profile, saveProfile } = useData();
  const toast = useToast();
  const front = useRef(null);
  const back = useRef(null);
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState(null);

  // Start from the saved design, or pre-fill from the agent profile the first time.
  useEffect(() => {
    if (d) return;
    setD({
      theme: 'gradient', logoSide: 'left', logo: '',
      name: profile.name || 'Your Name', title: 'Insurance Advisor', agency: profile.agency || 'Your Agency',
      tagline: 'Protecting what matters most', phone: profile.phone || '', email: profile.email || '', website: '', address: '',
      licence: profile.licence ? `IRDAI Licence: ${profile.licence}` : '',
      services: 'Motor, Health, Life, Travel, Business',
      ...profile.card,
    });
  }, [profile, d]);

  if (!d) return null;
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Please choose an image file', 'error');
    try {
      setD({ ...d, logo: await readLogo(file) });
    } catch {
      toast('Could not read that image', 'error');
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveProfile({ card: d });
      toast('Card design saved');
    } catch (e) {
      toast(e.message || 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async (ref, side) => {
    try {
      await downloadPng(ref.current, `business-card-${side}.png`);
    } catch {
      toast('Could not create the image', 'error');
    }
  };

  return (
    <>
      <PageHeader title="Business card" sub="Design a two-sided card with your logo and download it print-ready.">
        <Button variant="secondary" icon={Save} loading={busy} onClick={save}>Save design</Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Preview */}
        <div className="space-y-4 lg:col-span-3">
          {[['Front', front, Front, 'front'], ['Back', back, Back, 'back']].map(([label, ref, Face, side]) => (
            <Card key={side} className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-ink">{label}</p>
                <Button size="sm" variant="soft" icon={Download} onClick={() => download(ref, side)}>Download PNG</Button>
              </div>
              <div className="overflow-hidden rounded-2xl shadow-pop ring-1 ring-line">
                <Face d={d} svgRef={ref} />
              </div>
            </Card>
          ))}
          <p className="text-xs text-mute">Standard size 3.5 x 2 inch (89 x 51 mm). Files download at 2100 x 1200 px, sharp enough for any print shop.</p>
        </div>

        {/* Controls */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHead title="Style" />
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(THEMES).map(([id, t]) => (
                  <button key={id} onClick={() => setD({ ...d, theme: id })} className={cx('rounded-xl border p-2 text-[11px] font-bold transition', d.theme === id ? 'border-brand ring-2 ring-brand/25 text-brand-strong' : 'border-line text-mute')}>
                    <span className={cx('mb-1.5 block h-9 rounded-lg ring-1 ring-line', id === 'gradient' && 'bg-grad-deep')} style={id === 'white' ? { background: 'linear-gradient(90deg,#7445d1 32%,#fff 32%)' } : id === 'dark' ? { background: '#0b0b12' } : undefined} />
                    {t.label}
                  </button>
                ))}
              </div>

              <Field label="Company logo">
                <div className="flex items-center gap-3">
                  <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                    {d.logo ? <img src={d.logo} alt="Logo" className="max-h-full max-w-full object-contain p-1" /> : <ImagePlus className="size-6 text-faint" />}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={ImagePlus} onClick={() => fileInput.current.click()}>{d.logo ? 'Change logo' : 'Upload logo'}</Button>
                    {d.logo && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setD({ ...d, logo: '' })}>Remove</Button>}
                  </div>
                  <input ref={fileInput} type="file" accept="image/*" hidden onChange={onLogo} />
                </div>
              </Field>

              <Field label="Logo position on front">
                <Segmented value={d.logoSide} onChange={(v) => setD({ ...d, logoSide: v })} className="w-fit"
                  options={[{ id: 'left', label: <span className="flex items-center gap-1.5"><PanelLeft className="size-4" /> Left side</span> }, { id: 'right', label: <span className="flex items-center gap-1.5"><PanelRight className="size-4" /> Right side</span> }]} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHead title="Card details" />
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field label="Your name"><Input value={d.name} onChange={set('name')} /></Field>
              <Field label="Designation"><Input value={d.title} onChange={set('title')} /></Field>
              <Field label="Company / agency"><Input value={d.agency} onChange={set('agency')} /></Field>
              <Field label="Tagline"><Input value={d.tagline} onChange={set('tagline')} /></Field>
              <Field label="Mobile"><Input value={d.phone} onChange={set('phone')} /></Field>
              <Field label="Email"><Input value={d.email} onChange={set('email')} /></Field>
              <Field label="Website"><Input value={d.website} onChange={set('website')} placeholder="www.youragency.in" /></Field>
              <Field label="Licence line"><Input value={d.licence} onChange={set('licence')} placeholder="IRDAI Licence: ..." /></Field>
              <Field label="Address" className="sm:col-span-2 lg:col-span-1 xl:col-span-2"><Input value={d.address} onChange={set('address')} /></Field>
              <Field label="Services on the back" hint="Separate with commas" className="sm:col-span-2 lg:col-span-1 xl:col-span-2"><Input value={d.services} onChange={set('services')} /></Field>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
