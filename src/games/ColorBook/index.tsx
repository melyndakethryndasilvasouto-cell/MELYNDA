import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'
import coloringLessons from '../../data/coloringLessons.json'

// ─── Types ────────────────────────────────────────────────────────────────────
type FillMap = Record<string, string>
type UndoEntry = { id: string; prev: string }

interface DrawingDef {
  id: string
  name: string
  emoji: string
  verseRef: string
  verseText: string
  regions: string[]
  Component: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }>
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE: { label: string; color: string }[] = [
  { label: 'Branco',    color: '#FFFFFF' },
  { label: 'Preto',     color: '#111111' },
  { label: 'Vermelho',  color: '#EF4444' },
  { label: 'Laranja',   color: '#F97316' },
  { label: 'Amarelo',   color: '#FACC15' },
  { label: 'Lima',      color: '#84CC16' },
  { label: 'Verde',     color: '#22C55E' },
  { label: 'Teal',      color: '#14B8A6' },
  { label: 'Ciano',     color: '#06B6D4' },
  { label: 'Azul Ceu',  color: '#38BDF8' },
  { label: 'Azul',      color: '#3B82F6' },
  { label: 'Indigo',    color: '#6366F1' },
  { label: 'Violeta',   color: '#8B5CF6' },
  { label: 'Roxo',      color: '#A855F8' },
  { label: 'Rosa',      color: '#EC4899' },
  { label: 'Rose',      color: '#FB7185' },
  { label: 'Marrom',    color: '#92400E' },
  { label: 'Cinza',     color: '#9CA3AF' },
  { label: 'Azul Mel',  color: '#6BB8FF' },
  { label: 'Lilas Mel', color: '#A78BFA' },
  { label: 'Dourado',   color: '#F59E0B' },
  { label: 'Prata',     color: '#CBD5E1' },
  { label: 'Pessego',   color: '#FDBA74' },
  { label: 'Hortela',   color: '#6EE7B7' },
]

const UNCOLORED = '#E5E7EB'

// ─── Helper ───────────────────────────────────────────────────────────────────
function rp(
  id: string,
  fills: FillMap,
  onClick: (id: string) => void,
  extra?: object
) {
  return {
    id,
    fill: fills[id] ?? UNCOLORED,
    onClick: () => onClick(id),
    onKeyDown: (event: React.KeyboardEvent<SVGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onClick(id)
      }
    },
    tabIndex: 0,
    role: 'button',
    'aria-label': `Colorir região ${id.replace(/-/g, ' ')}`,
    style: { cursor: 'pointer' },
    stroke: '#9CA3AF',
    strokeWidth: 1,
    ...extra,
  }
}

// ─── SVG Drawings ─────────────────────────────────────────────────────────────

const ArkSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <rect x="5" y="8" width="190" height="118" rx="16" {...rp('ark-sky', fills, onClickRegion)} />
    <path d="M5 145 Q35 130 65 145 T125 145 T195 145 L195 195 L5 195 Z" {...rp('ark-water', fills, onClickRegion)} />
    <path d="M22 116 L178 116 L158 162 L42 162 Z" {...rp('ark-hull', fills, onClickRegion)} />
    <rect x="58" y="75" width="84" height="44" rx="5" {...rp('ark-cabin', fills, onClickRegion)} />
    <polygon points="50,78 100,48 150,78" {...rp('ark-roof', fills, onClickRegion)} />
    <rect x="91" y="91" width="18" height="28" rx="3" {...rp('ark-door', fills, onClickRegion)} />
    <circle cx="76" cy="94" r="8" {...rp('ark-window-l', fills, onClickRegion)} />
    <circle cx="124" cy="94" r="8" {...rp('ark-window-r', fills, onClickRegion)} />
    <circle cx="72" cy="57" r="10" {...rp('ark-animal-l', fills, onClickRegion)} />
    <circle cx="128" cy="57" r="10" {...rp('ark-animal-r', fills, onClickRegion)} />
    <path d="M40 48 A60 45 0 0 1 160 48 L150 55 A50 35 0 0 0 50 55 Z" {...rp('ark-rainbow-1', fills, onClickRegion)} />
    <path d="M52 55 A48 34 0 0 1 148 55 L138 61 A38 25 0 0 0 62 61 Z" {...rp('ark-rainbow-2', fills, onClickRegion)} />
  </svg>
)

const LambSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <rect x="5" y="145" width="190" height="50" rx="12" {...rp('lamb-field', fills, onClickRegion)} />
    <ellipse cx="98" cy="112" rx="58" ry="42" {...rp('lamb-body', fills, onClickRegion)} />
    <circle cx="144" cy="92" r="27" {...rp('lamb-head', fills, onClickRegion)} />
    <ellipse cx="125" cy="76" rx="18" ry="8" transform="rotate(25 125 76)" {...rp('lamb-ear-l', fills, onClickRegion)} />
    <ellipse cx="162" cy="76" rx="18" ry="8" transform="rotate(-25 162 76)" {...rp('lamb-ear-r', fills, onClickRegion)} />
    <rect x="60" y="138" width="14" height="35" rx="6" {...rp('lamb-leg-l', fills, onClickRegion)} />
    <rect x="116" y="138" width="14" height="35" rx="6" {...rp('lamb-leg-r', fills, onClickRegion)} />
    <circle cx="70" cy="91" r="21" {...rp('lamb-wool-l', fills, onClickRegion)} />
    <circle cx="101" cy="78" r="23" {...rp('lamb-wool-m', fills, onClickRegion)} />
    <circle cx="127" cy="101" r="21" {...rp('lamb-wool-r', fills, onClickRegion)} />
    <circle cx="151" cy="89" r="3" fill="#374151" />
    <path d="M143 102 Q151 108 159 102" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const UnicornSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <ellipse cx="100" cy="135" rx="48" ry="32" {...rp('uni-body', fills, onClickRegion)} />
    <rect x="85" y="95" width="28" height="30" rx="6" {...rp('uni-neck', fills, onClickRegion)} />
    <circle cx="100" cy="82" r="22" {...rp('uni-head', fills, onClickRegion)} />
    <polygon points="100,50 94,72 106,72" {...rp('uni-horn', fills, onClickRegion)} />
    <ellipse cx="114" cy="80" rx="10" ry="20" {...rp('uni-mane', fills, onClickRegion)} />
    <ellipse cx="148" cy="130" rx="10" ry="22" transform="rotate(-20 148 130)" {...rp('uni-tail', fills, onClickRegion)} />
    <rect x="67" y="160" width="14" height="28" rx="4" {...rp('uni-legs-l', fills, onClickRegion)} />
    <rect x="118" y="160" width="14" height="28" rx="4" {...rp('uni-legs-r', fills, onClickRegion)} />
    <circle cx="93" cy="80" r="4" fill={fills['uni-eye'] ?? UNCOLORED} onClick={() => onClickRegion('uni-eye')} style={{ cursor: 'pointer' }} stroke="#9CA3AF" strokeWidth={1} />
  </svg>
)

const ButterflySVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <ellipse cx="68" cy="80" rx="48" ry="38" transform="rotate(-25 68 80)" {...rp('bf-wing-ul', fills, onClickRegion)} />
    <ellipse cx="132" cy="80" rx="48" ry="38" transform="rotate(25 132 80)" {...rp('bf-wing-ur', fills, onClickRegion)} />
    <ellipse cx="72" cy="138" rx="34" ry="26" transform="rotate(15 72 138)" {...rp('bf-wing-ll', fills, onClickRegion)} />
    <ellipse cx="128" cy="138" rx="34" ry="26" transform="rotate(-15 128 138)" {...rp('bf-wing-lr', fills, onClickRegion)} />
    <ellipse cx="100" cy="108" rx="7" ry="30" {...rp('bf-body', fills, onClickRegion)} />
    <circle cx="100" cy="70" r="9" {...rp('bf-head', fills, onClickRegion)} />
    <line x1="95" y1="62" x2="82" y2="48" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="105" y1="62" x2="118" y2="48" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="81" cy="47" r="3" fill="#9CA3AF" />
    <circle cx="119" cy="47" r="3" fill="#9CA3AF" />
  </svg>
)

const FlowerSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <rect x="95" y="130" width="10" height="55" rx="4" {...rp('fl-stem', fills, onClickRegion)} />
    <ellipse cx="78" cy="155" rx="18" ry="9" transform="rotate(-30 78 155)" {...rp('fl-leaf-l', fills, onClickRegion)} />
    <ellipse cx="122" cy="155" rx="18" ry="9" transform="rotate(30 122 155)" {...rp('fl-leaf-r', fills, onClickRegion)} />
    <ellipse cx="100" cy="70" rx="12" ry="22" {...rp('fl-petal-t', fills, onClickRegion)} />
    <ellipse cx="100" cy="116" rx="12" ry="22" {...rp('fl-petal-b', fills, onClickRegion)} />
    <ellipse cx="78" cy="93" rx="22" ry="12" {...rp('fl-petal-l', fills, onClickRegion)} />
    <ellipse cx="122" cy="93" rx="22" ry="12" {...rp('fl-petal-r', fills, onClickRegion)} />
    <ellipse cx="84" cy="75" rx="13" ry="20" transform="rotate(-45 84 75)" {...rp('fl-petal-tl', fills, onClickRegion)} />
    <ellipse cx="116" cy="75" rx="13" ry="20" transform="rotate(45 116 75)" {...rp('fl-petal-tr', fills, onClickRegion)} />
    <circle cx="100" cy="93" r="18" {...rp('fl-center', fills, onClickRegion)} />
  </svg>
)

const StarSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <polygon points="100,20 115,65 162,65 125,92 140,138 100,112 60,138 75,92 38,65 85,65" {...rp('st-body', fills, onClickRegion)} />
    <polygon points="100,52 108,75 132,75 113,88 120,112 100,99 80,112 87,88 68,75 92,75" {...rp('st-inner', fills, onClickRegion)} />
    <circle cx="45" cy="35" r="8" {...rp('st-spark1', fills, onClickRegion)} />
    <circle cx="155" cy="40" r="6" {...rp('st-spark2', fills, onClickRegion)} />
    <circle cx="170" cy="130" r="7" {...rp('st-spark3', fills, onClickRegion)} />
    <circle cx="30" cy="125" r="7" {...rp('st-spark4', fills, onClickRegion)} />
    <circle cx="100" cy="160" r="9" {...rp('st-spark5', fills, onClickRegion)} />
  </svg>
)

const CatSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <ellipse cx="100" cy="145" rx="42" ry="36" {...rp('cat-body', fills, onClickRegion)} />
    <circle cx="100" cy="88" r="30" {...rp('cat-head', fills, onClickRegion)} />
    <polygon points="74,65 66,40 88,58" {...rp('cat-ear-l', fills, onClickRegion)} />
    <polygon points="126,65 134,40 112,58" {...rp('cat-ear-r', fills, onClickRegion)} />
    <ellipse cx="100" cy="96" rx="14" ry="10" {...rp('cat-muzzle', fills, onClickRegion)} />
    <path d="M142,165 Q170,140 165,110 Q162,95 150,105"
      fill="none"
      stroke={fills['cat-tail'] ?? UNCOLORED}
      strokeWidth="12"
      strokeLinecap="round"
      onClick={() => onClickRegion('cat-tail')}
      style={{ cursor: 'pointer' }}
    />
    <circle cx="89" cy="84" r="4" fill={fills['cat-eyes'] ?? UNCOLORED} onClick={() => onClickRegion('cat-eyes')} style={{ cursor: 'pointer' }} stroke="#9CA3AF" strokeWidth={0.5} />
    <circle cx="111" cy="84" r="4" fill={fills['cat-eyes'] ?? UNCOLORED} onClick={() => onClickRegion('cat-eyes')} style={{ cursor: 'pointer' }} stroke="#9CA3AF" strokeWidth={0.5} />
    <line x1="60" y1="94" x2="86" y2="96" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="60" y1="99" x2="86" y2="99" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="114" y1="96" x2="140" y2="94" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="114" y1="99" x2="140" y2="99" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

const RainbowSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => {
  const arc = (r: number, id: string) => {
    const r2 = r - 12
    const d = `M ${100 - r} 150 A ${r} ${r} 0 0 1 ${100 + r} 150 L ${100 + r2} 150 A ${r2} ${r2} 0 0 0 ${100 - r2} 150 Z`
    return (
      <path key={id} d={d} fill={fills[id] ?? UNCOLORED} stroke="#9CA3AF" strokeWidth={0.8}
        onClick={() => onClickRegion(id)} style={{ cursor: 'pointer' }} />
    )
  }
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
      {arc(155, 'rb-arc1')}
      {arc(143, 'rb-arc2')}
      {arc(131, 'rb-arc3')}
      {arc(119, 'rb-arc4')}
      {arc(107, 'rb-arc5')}
      <ellipse cx="35" cy="150" rx="28" ry="18" fill={fills['rb-cloud-l'] ?? UNCOLORED} stroke="#9CA3AF" strokeWidth={1} onClick={() => onClickRegion('rb-cloud-l')} style={{ cursor: 'pointer' }} />
      <ellipse cx="165" cy="150" rx="28" ry="18" fill={fills['rb-cloud-r'] ?? UNCOLORED} stroke="#9CA3AF" strokeWidth={1} onClick={() => onClickRegion('rb-cloud-r')} style={{ cursor: 'pointer' }} />
      <rect x="0" y="150" width="200" height="50" fill="#F3EEFF" style={{ pointerEvents: 'none' }} />
    </svg>
  )
}

const HeartSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <path d="M100 160 C100 160,25 115,25 70 C25 45,42 30,62 30 C78 30,92 40,100 52 C108 40,122 30,138 30 C158 30,175 45,175 70 C175 115,100 160,100 160 Z"
      {...rp('ht-outer', fills, onClickRegion)} />
    <path d="M100 130 C100 130,52 100,52 76 C52 62,62 54,72 54 C82 54,92 62,100 72 C108 62,118 54,128 54 C138 54,148 62,148 76 C148 100,100 130,100 130 Z"
      {...rp('ht-inner', fills, onClickRegion)} />
    <path d="M52 38 C52 38,38 28,38 20 C38 14,43 10,48 14 C53 10,58 14,58 20 C58 28,52 38,52 38 Z"
      {...rp('ht-deco1', fills, onClickRegion)} />
    <path d="M152 38 C152 38,138 28,138 20 C138 14,143 10,148 14 C153 10,158 14,158 20 C158 28,152 38,152 38 Z"
      {...rp('ht-deco2', fills, onClickRegion)} />
    <polygon points="165,80 168,88 176,88 170,94 172,102 165,97 158,102 160,94 154,88 162,88" {...rp('ht-star1', fills, onClickRegion)} />
    <polygon points="35,80 38,88 46,88 40,94 42,102 35,97 28,102 30,94 24,88 32,88" {...rp('ht-star2', fills, onClickRegion)} />
  </svg>
)

const CastleSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <rect x="30" y="100" width="140" height="80" rx="2" {...rp('cs-wall', fills, onClickRegion)} />
    <rect x="18" y="70" width="40" height="115" rx="2" {...rp('cs-tower-l', fills, onClickRegion)} />
    <rect x="142" y="70" width="40" height="115" rx="2" {...rp('cs-tower-r', fills, onClickRegion)} />
    <rect x="18" y="56" width="8" height="16" rx="1" {...rp('cs-cren-l', fills, onClickRegion)} />
    <rect x="30" y="56" width="8" height="16" rx="1" {...rp('cs-cren-l', fills, onClickRegion)} />
    <rect x="42" y="56" width="8" height="16" rx="1" {...rp('cs-cren-l', fills, onClickRegion)} />
    <rect x="142" y="56" width="8" height="16" rx="1" {...rp('cs-cren-r', fills, onClickRegion)} />
    <rect x="154" y="56" width="8" height="16" rx="1" {...rp('cs-cren-r', fills, onClickRegion)} />
    <rect x="166" y="56" width="8" height="16" rx="1" {...rp('cs-cren-r', fills, onClickRegion)} />
    <rect x="72" y="75" width="56" height="110" rx="2" {...rp('cs-turret', fills, onClickRegion)} />
    <rect x="72" y="60" width="10" height="17" rx="1" {...rp('cs-cren-m', fills, onClickRegion)} />
    <rect x="87" y="60" width="10" height="17" rx="1" {...rp('cs-cren-m', fills, onClickRegion)} />
    <rect x="102" y="60" width="10" height="17" rx="1" {...rp('cs-cren-m', fills, onClickRegion)} />
    <rect x="117" y="60" width="10" height="17" rx="1" {...rp('cs-cren-m', fills, onClickRegion)} />
    <path d="M88 185 L88 145 Q100 132 112 145 L112 185 Z" {...rp('cs-door', fills, onClickRegion)} />
    <ellipse cx="38" cy="100" rx="8" ry="10" {...rp('cs-win-l', fills, onClickRegion)} />
    <ellipse cx="162" cy="100" rx="8" ry="10" {...rp('cs-win-r', fills, onClickRegion)} />
    <ellipse cx="100" cy="102" rx="9" ry="11" {...rp('cs-win-m', fills, onClickRegion)} />
    <line x1="100" y1="20" x2="100" y2="62" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
    <polygon points="100,20 120,28 100,36" {...rp('cs-flag', fills, onClickRegion)} />
  </svg>
)

// ─── Drawing Registry ──────────────────────────────────────────────────────────
const lesson = (id: string) => coloringLessons.find(item => item.id === id)!

const DRAWINGS: DrawingDef[] = [
  { ...lesson('ark'), regions: ['ark-sky','ark-water','ark-hull','ark-cabin','ark-roof','ark-door','ark-window-l','ark-window-r','ark-animal-l','ark-animal-r','ark-rainbow-1','ark-rainbow-2'], Component: ArkSVG },
  { ...lesson('new-life'), regions: ['bf-wing-ul','bf-wing-ur','bf-wing-ll','bf-wing-lr','bf-body','bf-head'], Component: ButterflySVG },
  { ...lesson('creation'), regions: ['fl-stem','fl-leaf-l','fl-leaf-r','fl-petal-t','fl-petal-b','fl-petal-l','fl-petal-r','fl-petal-tl','fl-petal-tr','fl-center'], Component: FlowerSVG },
  { ...lesson('bethlehem'), regions: ['st-body','st-inner','st-spark1','st-spark2','st-spark3','st-spark4','st-spark5'], Component: StarSVG },
  { ...lesson('lamb'), regions: ['lamb-field','lamb-body','lamb-head','lamb-ear-l','lamb-ear-r','lamb-leg-l','lamb-leg-r','lamb-wool-l','lamb-wool-m','lamb-wool-r'], Component: LambSVG },
  { ...lesson('promise'), regions: ['rb-arc1','rb-arc2','rb-arc3','rb-arc4','rb-arc5','rb-cloud-l','rb-cloud-r'], Component: RainbowSVG },
  { ...lesson('love'), regions: ['ht-outer','ht-inner','ht-deco1','ht-deco2','ht-star1','ht-star2'], Component: HeartSVG },
  { ...lesson('fortress'), regions: ['cs-wall','cs-tower-l','cs-tower-r','cs-cren-l','cs-cren-r','cs-turret','cs-cren-m','cs-door','cs-win-l','cs-win-r','cs-win-m','cs-flag'], Component: CastleSVG },
]

function serializeDrawingWithVerse(svgElement: SVGSVGElement, drawing: DrawingDef) {
  const svg = svgElement.cloneNode(true) as SVGSVGElement
  const namespace = 'http://www.w3.org/2000/svg'
  svg.setAttribute('viewBox', '0 0 200 250')
  svg.setAttribute('width', '800')
  svg.setAttribute('height', '1000')
  svg.setAttribute('aria-label', `${drawing.name}. ${drawing.verseRef}. ${drawing.verseText}`)

  const footer = document.createElementNS(namespace, 'rect')
  footer.setAttribute('x', '0')
  footer.setAttribute('y', '200')
  footer.setAttribute('width', '200')
  footer.setAttribute('height', '50')
  footer.setAttribute('fill', '#FFFDF5')
  footer.setAttribute('stroke', '#E8D8A8')
  svg.appendChild(footer)

  const reference = document.createElementNS(namespace, 'text')
  reference.setAttribute('x', '100')
  reference.setAttribute('y', '218')
  reference.setAttribute('text-anchor', 'middle')
  reference.setAttribute('font-family', 'Nunito, sans-serif')
  reference.setAttribute('font-size', '9')
  reference.setAttribute('font-weight', '800')
  reference.setAttribute('fill', '#7B5EA7')
  reference.textContent = `${drawing.name} — ${drawing.verseRef}`
  svg.appendChild(reference)

  const words = drawing.verseText.split(' ')
  const lines: string[] = []
  for (const word of words) {
    const current = lines[lines.length - 1] ?? ''
    if (!current || `${current} ${word}`.length <= 42) {
      if (lines.length === 0) lines.push(word)
      else lines[lines.length - 1] = `${current} ${word}`
    } else if (lines.length < 2) {
      lines.push(word)
    }
  }

  lines.slice(0, 2).forEach((line, index) => {
    const text = document.createElementNS(namespace, 'text')
    text.setAttribute('x', '100')
    text.setAttribute('y', String(232 + index * 11))
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('font-family', 'Nunito, sans-serif')
    text.setAttribute('font-size', '7.5')
    text.setAttribute('fill', '#374151')
    text.textContent = line
    svg.appendChild(text)
  })

  return new XMLSerializer().serializeToString(svg)
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ColorBook() {
  const { playSound } = useSound()
  const { addAchievement } = usePlayer()

  const [drawingIdx, setDrawingIdx] = useState(0)
  const [selectedColor, setSelectedColor] = useState('#EF4444')
  const [fills, setFills] = useState<Record<string, FillMap>>(() =>
    Object.fromEntries(DRAWINGS.map(d => [d.id, {}]))
  )
  const [undoStack, setUndoStack] = useState<Record<string, UndoEntry[]>>(() =>
    Object.fromEntries(DRAWINGS.map(d => [d.id, []]))
  )
  const [showHelp, setShowHelp] = useState(false)
  const [switchModal, setSwitchModal] = useState<{ targetIdx: number } | null>(null)
  const [saveToast, setSaveToast] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completedRef = useRef<Set<string>>(new Set())

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const drawing = DRAWINGS[drawingIdx]
  const currentFills = fills[drawing.id]
  const currentUndo = undoStack[drawing.id]
  const coloredCount = drawing.regions.filter(r => currentFills[r] && currentFills[r] !== UNCOLORED).length
  const totalRegions = drawing.regions.length
  const isComplete = coloredCount === totalRegions
  const hasContent = coloredCount > 0

  useEffect(() => {
    if (!isComplete || completedRef.current.has(drawing.id)) return
    completedRef.current.add(drawing.id)
    addAchievement(`colorbook-${drawing.id}`)
    if (completedRef.current.size === DRAWINGS.length) addAchievement('colorbook-master')
  }, [addAchievement, drawing.id, isComplete])

  const handleClickRegion = useCallback((regionId: string) => {
    playSound('click')
    const prev = currentFills[regionId] ?? UNCOLORED
    setFills(f => ({ ...f, [drawing.id]: { ...f[drawing.id], [regionId]: selectedColor } }))
    setUndoStack(u => ({ ...u, [drawing.id]: [...u[drawing.id], { id: regionId, prev }] }))
  }, [playSound, currentFills, drawing.id, selectedColor])

  const handleUndo = () => {
    playSound('click')
    if (currentUndo.length === 0) return
    const last = currentUndo[currentUndo.length - 1]
    setFills(f => ({ ...f, [drawing.id]: { ...f[drawing.id], [last.id]: last.prev } }))
    setUndoStack(u => ({ ...u, [drawing.id]: u[drawing.id].slice(0, -1) }))
  }

  const handleClear = () => {
    playSound('click')
    setFills(f => ({ ...f, [drawing.id]: {} }))
    setUndoStack(u => ({ ...u, [drawing.id]: [] }))
  }

  const handleSave = () => {
    playSound('click')
    const svgEl = document.getElementById('coloring-svg') as unknown as SVGSVGElement | null
    if (!svgEl) return
    const svgData = serializeDrawingWithVerse(svgEl, drawing)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meu-desenho-${drawing.id}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setSaveToast(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setSaveToast(false), 2500)
  }

  const requestSwitch = (idx: number) => {
    playSound('click')
    if (idx === drawingIdx) return
    if (hasContent) { setSwitchModal({ targetIdx: idx }) }
    else { setDrawingIdx(idx) }
  }

  const confirmSwitch = (save: boolean) => {
    playSound('click')
    if (save) handleSave()
    if (switchModal) setDrawingIdx(switchModal.targetIdx)
    setSwitchModal(null)
  }

  const DrawingComponent = drawing.Component

  return (
    <div className="flex flex-col h-full min-h-0" style={{ fontFamily: 'Nunito, sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 flex-shrink-0">
        <h1 className="text-lg font-bold" style={{ fontFamily: 'Fredoka One, cursive', color: '#7B5EA7' }}>
          🎨 Colorindo a Bíblia
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white rounded-full px-3 py-1 shadow text-sm font-bold" style={{ color: '#4A90D9' }}>
            <span>{coloredCount}/{totalRegions}</span>
            <span className="text-xs font-normal" style={{ color: '#9CA3AF' }}>regioes</span>
          </div>
          <button className="btn-secondary text-sm px-3 py-1" style={{ minHeight: 36 }}
            onClick={() => { playSound('click'); setShowHelp(true) }}>
            Ajuda
          </button>
        </div>
      </div>

      {/* Drawing selector */}
      <div className="flex-shrink-0 px-2 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {DRAWINGS.map((d, i) => (
            <button key={d.id} onClick={() => requestSwitch(i)}
              className="flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl border-2 transition-all"
              style={{
                minHeight: 44, minWidth: 64,
                borderColor: i === drawingIdx ? '#A78BFA' : '#E5E7EB',
                background: i === drawingIdx ? '#EDE9FE' : '#fff',
                fontWeight: i === drawingIdx ? 700 : 500,
                color: i === drawingIdx ? '#7B5EA7' : '#6B7280',
                fontSize: 12,
              }}>
              <span style={{ fontSize: 20 }}>{d.emoji}</span>
              <span>{d.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0 px-2">
        <div className="glass-card game-area w-full h-full flex items-center justify-center relative overflow-hidden"
          style={{ cursor: 'crosshair', padding: 8, minHeight: 'min(72vw, 360px)' }}>
          <div
            role="img"
            aria-label={`Desenho para colorir: ${drawing.name}`}
            style={{ width: '100%', height: '100%', maxWidth: 360, maxHeight: 360 }}
          >
            <DrawingComponent fills={currentFills} onClickRegion={handleClickRegion} />
          </div>
          <AnimatePresence>
            {isComplete && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="absolute top-3 right-3 rounded-2xl px-3 py-1 font-bold text-sm shadow-lg"
                style={{ background: '#FACC15', color: '#fff', fontFamily: 'Fredoka One, cursive' }}>
                Completo!
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {saveToast && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-2xl px-4 py-2 font-bold text-sm shadow-lg"
                style={{ background: '#22C55E', color: '#fff' }}>
                Imagem salva!
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <section className="flex-shrink-0 mx-2 mt-2 px-3 py-2 rounded-2xl text-center" style={{ background: '#FFF9E8', border: '1px solid #F4D06F' }} aria-live="polite">
        <span className="verse-chip">{drawing.verseRef}</span>
        <p className="text-xs mt-1 font-bold leading-snug" style={{ color: '#5B3A8A' }}>{drawing.verseText}</p>
      </section>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <div className="flex items-center gap-2 justify-between">
          <div className="rounded-full border-4 border-white shadow-lg flex-shrink-0"
            style={{ width: 44, height: 44, background: selectedColor, boxShadow: '0 0 0 2px #A78BFA' }} />
          <div className="flex gap-2 flex-wrap justify-end">
            <button className="btn-secondary text-sm px-3" style={{ minHeight: 40 }}
              onClick={handleUndo} disabled={currentUndo.length === 0}>
              Desfazer
            </button>
            <button className="btn-secondary text-sm px-3"
              style={{ minHeight: 40, color: '#EF4444', borderColor: '#FCA5A5' }}
              onClick={handleClear}>
              Limpar
            </button>
            <button className="btn-primary text-sm px-3" style={{ minHeight: 40 }} onClick={handleSave}>
              Salvar
            </button>
          </div>
        </div>
      </div>

      {/* Palette */}
      <div className="flex-shrink-0 px-2 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {PALETTE.map(({ label, color }) => (
            <button key={color} title={label}
              onClick={() => { playSound('click'); setSelectedColor(color) }}
              className="flex-shrink-0 rounded-full transition-transform active:scale-90"
              style={{
                width: 36, height: 36, minWidth: 36,
                background: color,
                border: selectedColor === color ? '3px solid #7B5EA7' : '2px solid #D1D5DB',
                transform: selectedColor === color ? 'scale(1.2)' : 'scale(1)',
                boxShadow: selectedColor === color ? '0 0 0 2px #EDE9FE' : 'none',
              }}
              aria-label={label}
            />
          ))}
        </div>
      </div>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}>
            <motion.div className="glass-card p-6 max-w-sm w-full"
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-3 text-center"
                style={{ fontFamily: 'Fredoka One, cursive', color: '#7B5EA7' }}>
                Como Jogar
              </h2>
              <ul className="text-sm space-y-2" style={{ color: '#4B5563' }}>
                <li>Escolha uma cor na paleta colorida na parte de baixo.</li>
                <li>Clique em uma região do desenho — ou use Tab e Enter — para colorir.</li>
                <li>Escolha uma cena bíblica na fila no topo da tela.</li>
                <li>Desfazer remove a última pincelada.</li>
                <li>Limpar apaga todas as cores do desenho atual.</li>
                <li>Salvar baixa o SVG com a mensagem e a referência bíblica.</li>
                <li>Complete todas as regiões para ganhar um selo!</li>
              </ul>
              <button className="btn-primary w-full mt-4"
                onClick={() => { playSound('click'); setShowHelp(false) }}>
                Entendi!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switch Drawing Modal */}
      <AnimatePresence>
        {switchModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="glass-card p-6 max-w-xs w-full text-center"
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
              <div className="text-4xl mb-2">🖼</div>
              <h2 className="text-lg font-bold mb-1"
                style={{ fontFamily: 'Fredoka One, cursive', color: '#7B5EA7' }}>
                Trocar de Desenho
              </h2>
              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
                Voce quer salvar o desenho atual antes de trocar?
              </p>
              <div className="flex gap-3">
                <button className="btn-primary flex-1" onClick={() => confirmSwitch(true)}>
                  Salvar e Trocar
                </button>
                <button className="btn-secondary flex-1" onClick={() => confirmSwitch(false)}>
                  Trocar sem Salvar
                </button>
              </div>
              <button className="mt-2 text-sm underline w-full"
                style={{ color: '#9CA3AF', minHeight: 36 }}
                onClick={() => { playSound('click'); setSwitchModal(null) }}>
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
