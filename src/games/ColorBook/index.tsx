import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'
import coloringLessons from '../../data/coloringLessons.json'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PALETTE: { label: string; color: string }[] = [
  { label: 'Branco',         color: '#FFFFFF' },
  { label: 'Preto',          color: '#111111' },
  { label: 'Vermelho',       color: '#EF4444' },
  { label: 'Laranja',        color: '#F97316' },
  { label: 'Amarelo',        color: '#FACC15' },
  { label: 'Lima',           color: '#84CC16' },
  { label: 'Verde',          color: '#22C55E' },
  { label: 'Verde-Azulado',  color: '#14B8A6' },
  { label: 'Ciano',          color: '#06B6D4' },
  { label: 'Azul CÃ©u',       color: '#38BDF8' },
  { label: 'Azul',           color: '#3B82F6' },
  { label: 'Ãndigo',         color: '#6366F1' },
  { label: 'Violeta',        color: '#8B5CF6' },
  { label: 'Roxo',           color: '#A855F8' },
  { label: 'Rosa',           color: '#EC4899' },
  { label: 'Rosa-Claro',     color: '#FB7185' },
  { label: 'Marrom',         color: '#92400E' },
  { label: 'Cinza',          color: '#9CA3AF' },
  { label: 'Azul Mel',       color: '#6BB8FF' },
  { label: 'LilÃ¡s Mel',      color: '#A78BFA' },
  { label: 'Dourado',        color: '#F59E0B' },
  { label: 'Prata',          color: '#CBD5E1' },
  { label: 'PÃªssego',        color: '#FDBA74' },
  { label: 'HortelÃ£',        color: '#6EE7B7' },
]

const UNCOLORED = '#E5E7EB'

// â”€â”€â”€ Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    'aria-label': `Colorir regiÃ£o ${id.replace(/-/g, ' ')}`,
    style: { cursor: 'pointer' },
    stroke: '#9CA3AF',
    strokeWidth: 1,
    ...extra,
  }
}

// â”€â”€â”€ SVG Drawings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ArkSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" id="coloring-svg" width="100%" height="100%">
    <rect x="5" y="5" width="190" height="190" rx="16" {...rp('ark-sky', fills, onClickRegion)} />
    <circle cx="160" cy="40" r="15" stroke="#1a1a1a" strokeWidth="1.5" {...rp('ark-sun', fills, onClickRegion)} />
    <path d="M 30 50 C 30 40, 45 35, 55 45 C 65 35, 80 40, 80 50 C 85 50, 90 60, 85 65 C 80 70, 30 70, 25 65 C 20 60, 25 50, 30 50 Z" stroke="#1a1a1a" strokeWidth="1.5" {...rp('ark-c1', fills, onClickRegion)} />
    <path d="M 120 70 C 120 65, 130 60, 135 65 C 140 60, 150 65, 150 70 C 155 70, 155 75, 150 80 C 145 80, 120 80, 115 75 C 110 75, 115 70, 120 70 Z" stroke="#1a1a1a" strokeWidth="1.5" {...rp('ark-c2', fills, onClickRegion)} />
    <path d="M 20 140 C 40 160, 160 160, 180 140 L 175 110 L 25 110 Z" stroke="#1a1a1a" strokeWidth="2" {...rp('ark-hull', fills, onClickRegion)} />
    <path d="M 23 120 C 50 125, 150 125, 177 120" fill="none" stroke="#1a1a1a" strokeWidth="1" />
    <path d="M 22 130 C 50 140, 150 140, 178 130" fill="none" stroke="#1a1a1a" strokeWidth="1" />
    <path d="M 40 110 L 160 110 L 155 85 L 45 85 Z" stroke="#1a1a1a" strokeWidth="1.5" {...rp('ark-cb-base', fills, onClickRegion)} />
    <path d="M 50 85 L 150 85 L 140 60 L 60 60 Z" stroke="#1a1a1a" strokeWidth="1.5" {...rp('ark-cb-up', fills, onClickRegion)} />
    <path d="M 45 60 L 155 60 L 100 35 Z" stroke="#1a1a1a" strokeWidth="1.5" {...rp('ark-roof', fills, onClickRegion)} />
    <path d="M 85 110 L 85 85 C 85 75, 115 75, 115 85 L 115 110 Z" stroke="#1a1a1a" strokeWidth="1.5" {...rp('ark-door', fills, onClickRegion)} />
    <rect x="55" y="90" width="12" height="12" rx="2" stroke="#1a1a1a" strokeWidth="1.5" {...rp('ark-w1', fills, onClickRegion)} />
    <rect x="133" y="90" width="12" height="12" rx="2" stroke="#1a1a1a" strokeWidth="1.5" {...rp('ark-w2', fills, onClickRegion)} />
    <path d="M 5 160 C 20 150, 30 170, 50 160 C 70 150, 80 170, 100 160 C 120 150, 130 170, 150 160 C 170 150, 180 170, 195 160 L 195 195 L 5 195 Z" stroke="#1a1a1a" strokeWidth="1.5" {...rp('ark-wa1', fills, onClickRegion)} />
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
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" id="coloring-svg" width="100%" height="100%">
    <path d="M 97 32 C 90 20, 80 10, 65 15" strokeWidth="2.5" fill="none" stroke="#1a1a1a" />
    <circle cx="65" cy="15" r="2.5" stroke="#1a1a1a" {...rp('bf-ant-l-t', fills, onClickRegion)} />
    <path d="M 103 32 C 110 20, 120 10, 135 15" strokeWidth="2.5" fill="none" stroke="#1a1a1a" />
    <circle cx="135" cy="15" r="2.5" stroke="#1a1a1a" {...rp('bf-ant-r-t', fills, onClickRegion)} />
    <path strokeWidth="2.5" stroke="#1a1a1a" d="M 95 45 C 70 30, 35 25, 15 35 C 10 50, 15 80, 25 105 C 40 115, 75 105, 95 65 Z" {...rp('bf-w-tl', fills, onClickRegion)} />
    <path strokeWidth="2.5" stroke="#1a1a1a" d="M 105 45 C 130 30, 165 25, 185 35 C 190 50, 185 80, 175 105 C 160 115, 125 105, 105 65 Z" {...rp('bf-w-tr', fills, onClickRegion)} />
    <path strokeWidth="2.5" stroke="#1a1a1a" d="M 95 75 C 70 85, 45 95, 30 115 C 20 135, 35 160, 45 175 C 45 175, 40 195, 40 195 C 48 190, 52 178, 55 178 C 65 185, 85 180, 95 140 Z" {...rp('bf-w-bl', fills, onClickRegion)} />
    <path strokeWidth="2.5" stroke="#1a1a1a" d="M 105 75 C 130 85, 155 95, 170 115 C 180 135, 165 160, 155 175 C 155 175, 160 195, 160 195 C 152 190, 148 178, 145 178 C 135 185, 115 180, 105 140 Z" {...rp('bf-w-br', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 90 48 C 65 38, 35 35, 22 40 C 35 48, 65 52, 90 55 Z" {...rp('bf-wtl-p1', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 88 58 C 60 55, 30 55, 20 60 C 25 70, 40 85, 60 82 C 75 80, 85 70, 90 62 Z" {...rp('bf-wtl-p2', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 85 68 C 65 75, 45 90, 32 95 C 45 102, 65 100, 80 85 Z" {...rp('bf-wtl-p3', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 110 48 C 135 38, 165 35, 178 40 C 165 48, 135 52, 110 55 Z" {...rp('bf-wtr-p1', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 112 58 C 140 55, 170 55, 180 60 C 175 70, 160 85, 140 82 C 125 80, 115 70, 110 62 Z" {...rp('bf-wtr-p2', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 115 68 C 135 75, 155 90, 168 95 C 155 102, 135 100, 120 85 Z" {...rp('bf-wtr-p3', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 90 85 C 75 92, 55 102, 40 115 C 55 125, 75 115, 88 100 Z" {...rp('bf-wbl-p1', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 85 105 C 70 120, 50 135, 35 145 C 50 155, 65 145, 80 125 Z" {...rp('bf-wbl-p2', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 80 130 C 70 145, 60 160, 52 170 C 65 170, 75 160, 85 142 Z" {...rp('bf-wbl-p3', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 110 85 C 125 92, 145 102, 160 115 C 145 125, 125 115, 112 100 Z" {...rp('bf-wbr-p1', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 115 105 C 130 120, 150 135, 165 145 C 150 155, 135 145, 120 125 Z" {...rp('bf-wbr-p2', fills, onClickRegion)} />
    <path strokeWidth="1.5" stroke="#1a1a1a" d="M 120 130 C 130 145, 140 160, 148 170 C 135 170, 125 160, 115 142 Z" {...rp('bf-wbr-p3', fills, onClickRegion)} />
    <ellipse cx="100" cy="90" rx="6" ry="25" strokeWidth="2.5" stroke="#1a1a1a" {...rp('bf-ab', fills, onClickRegion)} />
    <ellipse cx="100" cy="55" rx="7" ry="12" strokeWidth="2.5" stroke="#1a1a1a" {...rp('bf-th', fills, onClickRegion)} />
    <circle cx="100" cy="36" r="5" strokeWidth="2.5" stroke="#1a1a1a" {...rp('bf-hd', fills, onClickRegion)} />
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
    const r2 = r - 10
    const d = `M ${100 - r} 160 A ${r} ${r} 0 0 1 ${100 + r} 160 L ${100 + r2} 160 A ${r2} ${r2} 0 0 0 ${100 - r2} 160 Z`
    return (
      <path key={id} d={d} fill={fills[id] ?? UNCOLORED} stroke="#1a1a1a" strokeWidth={1.5}
        onClick={() => onClickRegion(id)} style={{ cursor: 'pointer' }} />
    )
  }
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
      <rect x="5" y="5" width="190" height="190" rx="16" {...rp('rb-sky', fills, onClickRegion)} />
      {arc(90, 'rb-arc1')}
      {arc(80, 'rb-arc2')}
      {arc(70, 'rb-arc3')}
      {arc(60, 'rb-arc4')}
      {arc(50, 'rb-arc5')}
      <path d="M 20 160 Q 30 140 45 145 Q 55 130 70 145 Q 85 140 90 160 Z" stroke="#1a1a1a" strokeWidth="1.5" {...rp('rb-cloud-l', fills, onClickRegion)} />
      <path d="M 180 160 Q 170 140 155 145 Q 145 130 130 145 Q 115 140 110 160 Z" stroke="#1a1a1a" strokeWidth="1.5" {...rp('rb-cloud-r', fills, onClickRegion)} />
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

// â”€â”€â”€ Drawing Registry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const lesson = (id: string) => coloringLessons.find(item => item.id === id)!

const CrossSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <rect x="5" y="8" width="190" height="184" rx="16" {...rp('cr-sky', fills, onClickRegion)} />
    <path d="M 5 150 Q 100 120 195 150 L 195 192 L 5 192 Z" {...rp('cr-hill', fills, onClickRegion)} />
    <rect x="90" y="40" width="20" height="120" rx="3" {...rp('cr-wood-v', fills, onClickRegion)} />
    <rect x="60" y="60" width="80" height="20" rx="3" {...rp('cr-wood-h', fills, onClickRegion)} />
    <circle cx="160" cy="40" r="20" {...rp('cr-sun', fills, onClickRegion)} />
    <path d="M 20 50 Q 30 30 50 40 Q 70 30 75 50 Q 90 60 70 70 Q 50 80 30 65 Q 10 60 20 50 Z" {...rp('cr-cloud', fills, onClickRegion)} />
  </svg>
)

const LoavesSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <rect x="5" y="8" width="190" height="184" rx="16" {...rp('lv-bg', fills, onClickRegion)} />
    <path d="M 30 100 L 45 170 L 155 170 L 170 100 Z" {...rp('lv-basket', fills, onClickRegion)} />
    <ellipse cx="100" cy="100" rx="70" ry="20" {...rp('lv-basket-top', fills, onClickRegion)} />
    <ellipse cx="60" cy="85" rx="25" ry="15" {...rp('lv-bread1', fills, onClickRegion)} />
    <ellipse cx="100" cy="75" rx="25" ry="15" {...rp('lv-bread2', fills, onClickRegion)} />
    <ellipse cx="140" cy="85" rx="25" ry="15" {...rp('lv-bread3', fills, onClickRegion)} />
    <ellipse cx="80" cy="60" rx="25" ry="15" {...rp('lv-bread4', fills, onClickRegion)} />
    <ellipse cx="120" cy="60" rx="25" ry="15" {...rp('lv-bread5', fills, onClickRegion)} />
    <path d="M 40 130 Q 70 110 90 130 Q 110 150 120 120 L 135 110 L 130 135 Z" {...rp('lv-fish1', fills, onClickRegion)} />
    <path d="M 160 130 Q 130 110 110 130 Q 90 150 80 120 L 65 110 L 70 135 Z" {...rp('lv-fish2', fills, onClickRegion)} />
  </svg>
)

const CrownSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <rect x="5" y="8" width="190" height="184" rx="16" {...rp('cw-bg', fills, onClickRegion)} />
    <path d="M 30 150 L 40 80 L 70 120 L 100 60 L 130 120 L 160 80 L 170 150 Z" {...rp('cw-gold', fills, onClickRegion)} />
    <rect x="25" y="150" width="150" height="20" rx="5" {...rp('cw-base', fills, onClickRegion)} />
    <circle cx="40" cy="80" r="8" {...rp('cw-j1', fills, onClickRegion)} />
    <circle cx="100" cy="60" r="10" {...rp('cw-j2', fills, onClickRegion)} />
    <circle cx="160" cy="80" r="8" {...rp('cw-j3', fills, onClickRegion)} />
    <polygon points="100,130 90,140 100,150 110,140" {...rp('cw-j4', fills, onClickRegion)} />
    <polygon points="60,135 55,142 60,149 65,142" {...rp('cw-j5', fills, onClickRegion)} />
    <polygon points="140,135 135,142 140,149 145,142" {...rp('cw-j6', fills, onClickRegion)} />
  </svg>
)

const DoveSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <rect x="5" y="8" width="190" height="184" rx="16" {...rp('dv-sky', fills, onClickRegion)} />
    <path d="M 100 100 C 70 90 40 110 30 70 C 60 70 80 80 100 100 Z" {...rp('dv-wing-l', fills, onClickRegion)} />
    <path d="M 100 100 C 130 90 160 110 170 70 C 140 70 120 80 100 100 Z" {...rp('dv-wing-r', fills, onClickRegion)} />
    <ellipse cx="100" cy="115" rx="20" ry="40" {...rp('dv-body', fills, onClickRegion)} />
    <circle cx="100" cy="65" r="15" {...rp('dv-head', fills, onClickRegion)} />
    <polygon points="100,75 95,50 105,50" {...rp('dv-beak', fills, onClickRegion)} />
    <path d="M 85 145 L 70 170 L 95 160 Z" {...rp('dv-tail-l', fills, onClickRegion)} />
    <path d="M 115 145 L 130 170 L 105 160 Z" {...rp('dv-tail-r', fills, onClickRegion)} />
    <path d="M 100 50 Q 120 30 140 40" fill="none" stroke="#22C55E" strokeWidth="3" />
    <circle cx="125" cy="35" r="5" {...rp('dv-leaf1', fills, onClickRegion)} />
    <circle cx="135" cy="45" r="5" {...rp('dv-leaf2', fills, onClickRegion)} />
  </svg>
)

const WhaleSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <rect x="5" y="8" width="190" height="184" rx="16" {...rp('wh-sky', fills, onClickRegion)} />
    <path d="M 5 130 Q 50 140 100 130 T 195 130 L 195 192 L 5 192 Z" {...rp('wh-water', fills, onClickRegion)} />
    <path d="M 150 110 Q 100 40 40 90 Q 20 110 30 130 Q 100 150 170 130 L 180 100 Z" {...rp('wh-body', fills, onClickRegion)} />
    <path d="M 170 130 L 190 110 L 190 150 Z" {...rp('wh-tail', fills, onClickRegion)} />
    <ellipse cx="100" cy="130" rx="30" ry="10" {...rp('wh-belly', fills, onClickRegion)} />
    <circle cx="50" cy="95" r="6" {...rp('wh-eye', fills, onClickRegion)} />
    <path d="M 100 65 Q 100 40 80 30" fill="none" stroke="#38BDF8" strokeWidth="4" />
    <path d="M 105 65 Q 110 30 130 20" fill="none" stroke="#38BDF8" strokeWidth="4" />
    <circle cx="75" cy="35" r="8" {...rp('wh-spout1', fills, onClickRegion)} />
    <circle cx="130" cy="25" r="8" {...rp('wh-spout2', fills, onClickRegion)} />
  </svg>
)

const TabletsSVG: React.FC<{ fills: FillMap; onClickRegion: (id: string) => void }> = ({ fills, onClickRegion }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" id="coloring-svg" width="100%" height="100%">
    <rect x="5" y="8" width="190" height="184" rx="16" {...rp('tb-bg', fills, onClickRegion)} />
    <path d="M 5 150 Q 100 100 195 150 L 195 192 L 5 192 Z" {...rp('tb-hill', fills, onClickRegion)} />
    <path d="M 40 70 A 30 30 0 0 1 100 70 L 100 140 L 40 140 Z" {...rp('tb-tab1', fills, onClickRegion)} />
    <path d="M 100 70 A 30 30 0 0 1 160 70 L 160 140 L 100 140 Z" {...rp('tb-tab2', fills, onClickRegion)} />
    <line x1="55" y1="80" x2="85" y2="80" stroke="#000" strokeWidth="2" />
    <line x1="55" y1="95" x2="85" y2="95" stroke="#000" strokeWidth="2" />
    <line x1="55" y1="110" x2="85" y2="110" stroke="#000" strokeWidth="2" />
    <line x1="55" y1="125" x2="85" y2="125" stroke="#000" strokeWidth="2" />
    <line x1="115" y1="80" x2="145" y2="80" stroke="#000" strokeWidth="2" />
    <line x1="115" y1="95" x2="145" y2="95" stroke="#000" strokeWidth="2" />
    <line x1="115" y1="110" x2="145" y2="110" stroke="#000" strokeWidth="2" />
    <line x1="115" y1="125" x2="145" y2="125" stroke="#000" strokeWidth="2" />
  </svg>
)


// Pseudo-random number generator
function random(seed: number) {
  let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

export function getMandalaRegions(seed: number): string[] {
  const rings = 4 + Math.floor(random(seed) * 3);
  const segments = 6 + Math.floor(random(seed * 2) * 6) * 2;
  const regions = [`md-${seed}-bg`, `md-${seed}-0`];
  let idx = 1;
  for (let r = 1; r <= rings; r++) {
    for (let s = 0; s < segments; s++) {
      regions.push(`md-${seed}-${idx++}`);
    }
  }
  return regions;
}

const MandalaSVG: React.FC<{ seed: number; fills: FillMap; onClickRegion: (id: string) => void }> = ({ seed, fills, onClickRegion }) => {
  const rings = 4 + Math.floor(random(seed) * 3);
  const segments = 6 + Math.floor(random(seed * 2) * 6) * 2;
  const shapes = [];
  let regionIndex = 0;
  
  shapes.push(
    <circle key="center" cx="100" cy="100" r={10 + random(seed)*10} 
      {...rp(`md-${seed}-${regionIndex++}`, fills, onClickRegion, { stroke: '#1a1a1a', strokeWidth: 1.5 })} />
  );
  
  for (let r = 1; r <= rings; r++) {
    const radius = 20 + r * (80 / rings);
    const prevRadius = 20 + (r - 1) * (80 / rings);
    const shapeType = Math.floor(random(seed * r * 3) * 3);
    for (let s = 0; s < segments; s++) {
      const angle = (s * 360) / segments;
      const nextAngle = ((s + 1) * 360) / segments;
      const rad1 = (angle * Math.PI) / 180;
      const rad2 = (nextAngle * Math.PI) / 180;
      const x1 = 100 + prevRadius * Math.cos(rad1);
      const y1 = 100 + prevRadius * Math.sin(rad1);
      const x2 = 100 + prevRadius * Math.cos(rad2);
      const y2 = 100 + prevRadius * Math.sin(rad2);
      const x3 = 100 + radius * Math.cos(rad2);
      const y3 = 100 + radius * Math.sin(rad2);
      const x4 = 100 + radius * Math.cos(rad1);
      const y4 = 100 + radius * Math.sin(rad1);
      
      if (shapeType === 0) {
        shapes.push(
          <path key={`${r}-${s}`} d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`} 
            {...rp(`md-${seed}-${regionIndex++}`, fills, onClickRegion, { stroke: '#1a1a1a', strokeWidth: 1.5 })} />
        );
      } else if (shapeType === 1) {
        const midX = 100 + radius * Math.cos((rad1+rad2)/2);
        const midY = 100 + radius * Math.sin((rad1+rad2)/2);
        shapes.push(
          <path key={`${r}-${s}`} d={`M ${x1} ${y1} L ${x2} ${y2} L ${midX} ${midY} Z`} 
            {...rp(`md-${seed}-${regionIndex++}`, fills, onClickRegion, { stroke: '#1a1a1a', strokeWidth: 1.5 })} />
        );
      } else {
        const midX = 100 + ((prevRadius + radius)/2) * Math.cos((rad1+rad2)/2);
        const midY = 100 + ((prevRadius + radius)/2) * Math.sin((rad1+rad2)/2);
        shapes.push(
          <circle key={`${r}-${s}`} cx={midX} cy={midY} r={(radius - prevRadius)/2.5}
            {...rp(`md-${seed}-${regionIndex++}`, fills, onClickRegion, { stroke: '#1a1a1a', strokeWidth: 1.5 })} />
        );
      }
    }
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" id="coloring-svg" width="100%" height="100%">
      <rect x="5" y="5" width="190" height="190" rx="16" {...rp(`md-${seed}-bg`, fills, onClickRegion, { stroke: '#1a1a1a', strokeWidth: 1.5 })} />
      {shapes}
    </svg>
  );
};

const MANDALA_DRAWINGS: DrawingDef[] = Array.from({ length: 100 }).map((_, i) => ({
  id: `mandala-${i}`,
  name: `Vitral ${i + 1}`,
  emoji: '💠',
  verseRef: 'Salmos 19:1',
  verseText: 'Os céus declaram a glória de Deus; o firmamento proclama a obra das suas mãos.',
  regions: getMandalaRegions(i),
  Component: ({ fills, onClickRegion }) => <MandalaSVG seed={i} fills={fills} onClickRegion={onClickRegion} />
}));

const DRAWINGS: DrawingDef[] = [
  { ...lesson('ark'), regions: ['ark-sky', 'ark-sun', 'ark-c1', 'ark-c2', 'ark-hull', 'ark-cb-base', 'ark-cb-up', 'ark-roof', 'ark-door', 'ark-w1', 'ark-w2', 'ark-wa1'], Component: ArkSVG },
  { ...lesson('new-life'), regions: ['bf-ant-l-t', 'bf-ant-r-t', 'bf-w-tl', 'bf-w-tr', 'bf-w-bl', 'bf-w-br', 'bf-wtl-p1', 'bf-wtl-p2', 'bf-wtl-p3', 'bf-wtr-p1', 'bf-wtr-p2', 'bf-wtr-p3', 'bf-wbl-p1', 'bf-wbl-p2', 'bf-wbl-p3', 'bf-wbr-p1', 'bf-wbr-p2', 'bf-wbr-p3', 'bf-ab', 'bf-th', 'bf-hd'], Component: ButterflySVG },
  { ...lesson('creation'), regions: ['fl-stem','fl-leaf-l','fl-leaf-r','fl-petal-t','fl-petal-b','fl-petal-l','fl-petal-r','fl-petal-tl','fl-petal-tr','fl-center'], Component: FlowerSVG },
  { ...lesson('bethlehem'), regions: ['st-body','st-inner','st-spark1','st-spark2','st-spark3','st-spark4','st-spark5'], Component: StarSVG },
  { ...lesson('lamb'), regions: ['lamb-field','lamb-body','lamb-head','lamb-ear-l','lamb-ear-r','lamb-leg-l','lamb-leg-r','lamb-wool-l','lamb-wool-m','lamb-wool-r'], Component: LambSVG },
  { ...lesson('promise'), regions: ['rb-sky', 'rb-arc1','rb-arc2','rb-arc3','rb-arc4','rb-arc5','rb-cloud-l','rb-cloud-r'], Component: RainbowSVG },
  { ...lesson('love'), regions: ['ht-outer','ht-inner','ht-deco1','ht-deco2','ht-star1','ht-star2'], Component: HeartSVG },
  { ...lesson('fortress'), regions: ['cs-wall','cs-tower-l','cs-tower-r','cs-cren-l','cs-cren-r','cs-turret','cs-cren-m','cs-door','cs-win-l','cs-win-r','cs-win-m','cs-flag'], Component: CastleSVG },
  { ...lesson('cross'), regions: ['cr-sky','cr-hill','cr-wood-v','cr-wood-h','cr-sun','cr-cloud'], Component: CrossSVG },
  { ...lesson('loaves'), regions: ['lv-bg','lv-basket','lv-basket-top','lv-bread1','lv-bread2','lv-bread3','lv-bread4','lv-bread5','lv-fish1','lv-fish2'], Component: LoavesSVG },
  { ...lesson('crown'), regions: ['cw-bg','cw-gold','cw-base','cw-j1','cw-j2','cw-j3','cw-j4','cw-j5','cw-j6'], Component: CrownSVG },
  { ...lesson('dove'), regions: ['dv-sky','dv-wing-l','dv-wing-r','dv-body','dv-head','dv-beak','dv-tail-l','dv-tail-r','dv-leaf1','dv-leaf2'], Component: DoveSVG },
  { ...lesson('whale'), regions: ['wh-sky','wh-water','wh-body','wh-tail','wh-belly','wh-eye','wh-spout1','wh-spout2'], Component: WhaleSVG },
  { ...lesson('tablets'), regions: ['tb-bg','tb-hill','tb-tab1','tb-tab2'], Component: TabletsSVG },
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
  reference.textContent = `${drawing.name} â€” ${drawing.verseRef}`
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

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ALL_DRAWINGS = [...DRAWINGS, ...MANDALA_DRAWINGS];

export default function ColorBook() {
  const { playSound } = useSound()
  const { addAchievement } = usePlayer()

  const [drawingIdx, setDrawingIdx] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'drawing'>('grid')
  const [activeCategory, setActiveCategory] = useState<'bible' | 'mandala'>('bible')
  const [selectedColor, setSelectedColor] = useState('#EF4444')
  const [fills, setFills] = useState<Record<string, FillMap>>(() =>
    Object.fromEntries((DRAWINGS.concat(MANDALA_DRAWINGS)).map(d => [d.id, {}]))
  )
  const [undoStack, setUndoStack] = useState<Record<string, UndoEntry[]>>(() =>
    Object.fromEntries((DRAWINGS.concat(MANDALA_DRAWINGS)).map(d => [d.id, []]))
  )
  const [showHelp, setShowHelp] = useState(false)
  const [switchModal, setSwitchModal] = useState<{ targetIdx: number } | null>(null)
  const [saveToast, setSaveToast] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completedRef = useRef<Set<string>>(new Set())

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const drawing = ALL_DRAWINGS[drawingIdx]
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
    // ðŸŽ‰ Celebration!
    playSound('win')
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: ['#6BB8FF','#A78BFA','#FCD34D','#34D399','#ffffff'] })
    setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.4, x: 0.3 }, colors: ['#FCA5A5','#A78BFA','#FCD34D'] }), 350)
    setShowCelebration(true)
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current)
    celebrationTimer.current = setTimeout(() => setShowCelebration(false), 3500)
  }, [addAchievement, drawing.id, isComplete, playSound])

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
    if (idx === drawingIdx) {
      setViewMode('drawing')
      return
    }
    setDrawingIdx(idx)
    setViewMode('drawing')
  }

  const handleBackToGrid = () => {
    playSound('click')
    if (hasContent && !isComplete) {
      setSwitchModal({ targetIdx: -1 })
    } else {
      setViewMode('grid')
    }
  }

  const confirmSwitch = (save: boolean) => {
    playSound('click')
    if (save) handleSave()
    if (switchModal) {
      if (switchModal.targetIdx === -1) {
        setViewMode('grid')
      } else {
        setDrawingIdx(switchModal.targetIdx)
        setViewMode('drawing')
      }
    }
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
          {viewMode === 'drawing' && (
            <div className="flex items-center gap-1 bg-white rounded-full px-3 py-1 shadow text-sm font-bold" style={{ color: '#4A90D9' }}>
              <span>{coloredCount}/{totalRegions}</span>
              <span className="text-xs font-normal" style={{ color: '#9CA3AF' }}>regiões</span>
            </div>
          )}
          <button className="btn-secondary text-sm px-3 py-1" style={{ minHeight: 36 }}
            onClick={() => { playSound('click'); setShowHelp(true) }}>
            Ajuda
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <motion.div 
          key="grid-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col min-h-0 px-3 pb-2"
        >
          {/* Category Selector */}
          <div className="flex gap-2 mb-3 bg-white p-1 rounded-2xl shadow-sm border border-gray-100 flex-shrink-0">
            <button 
              className={`flex-1 py-2 rounded-xl font-bold transition-all ${activeCategory === 'bible' ? 'bg-[#7B5EA7] text-white shadow' : 'bg-transparent text-[#6B7280] hover:bg-gray-50'}`}
              onClick={() => { playSound('click'); setActiveCategory('bible') }}
            >
              Histórias Bíblicas
            </button>
            <button 
              className={`flex-1 py-2 rounded-xl font-bold transition-all ${activeCategory === 'mandala' ? 'bg-[#7B5EA7] text-white shadow' : 'bg-transparent text-[#6B7280] hover:bg-gray-50'}`}
              onClick={() => { playSound('click'); setActiveCategory('mandala') }}
            >
              Mandalas
            </button>
          </div>
          
          {/* Grid */}
          <div className="flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            <motion.div 
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-4"
            >
              {(activeCategory === 'bible' ? DRAWINGS : MANDALA_DRAWINGS).map((d, localIndex) => {
                const globalIdx = activeCategory === 'bible' ? localIndex : DRAWINGS.length + localIndex;
                const isCompleted = completedRef.current.has(d.id) || (fills[d.id] && Object.values(fills[d.id]).filter(v => v !== '#E5E7EB').length === d.regions.length);
                return (
                  <button key={d.id} onClick={() => requestSwitch(globalIdx)}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 relative"
                    style={{
                      borderColor: '#E5E7EB',
                      background: '#fff',
                      color: '#4B5563',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                      aspectRatio: '1',
                    }}>
                    <span style={{ fontSize: '3rem' }}>{d.emoji}</span>
                    <span className="text-sm font-bold text-center leading-tight">{d.name}</span>
                    {isCompleted && (
                      <div className="absolute top-2 right-2 flex items-center justify-center bg-green-100 text-green-600 rounded-full w-6 h-6 shadow-sm border border-green-200">
                        ✓
                      </div>
                    )}
                  </button>
                )
              })}
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="drawing-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex flex-col min-h-0"
        >
          {/* Back Button & Title */}
          <div className="px-3 pb-2 flex justify-between items-center flex-shrink-0">
            <button className="btn-secondary text-sm px-3 py-1 flex items-center gap-1" onClick={handleBackToGrid}>
              <span>←</span> Voltar
            </button>
            <div className="text-sm font-bold bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100" style={{ color: '#7B5EA7' }}>
              {drawing.emoji} {drawing.name}
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
            <button className="btn-secondary text-sm px-3" style={{ minHeight: 44 }}
              onClick={handleUndo} disabled={currentUndo.length === 0}>
              Desfazer
            </button>
            <button className="btn-secondary text-sm px-3"
              style={{ minHeight: 44, color: '#EF4444', borderColor: '#FCA5A5' }}
              onClick={handleClear}>
              Limpar
            </button>
            <button className="btn-primary text-sm px-3" style={{ minHeight: 44 }} onClick={handleSave}>
              Salvar
            </button>
          </div>
        </div>
      </div>

      {/* Palette */}
      <div className="flex-shrink-0 px-2 pb-4 w-full max-w-2xl mx-auto mt-2">
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 p-1">
          {PALETTE.map(({ label, color }) => (
            <button key={color} title={label}
              onClick={() => { playSound('click'); setSelectedColor(color) }}
              className="flex-shrink-0 rounded-full transition-transform active:scale-90"
              style={{
                width: 44, height: 44,
                background: color,
                border: selectedColor === color
                  ? '3px solid #7B5EA7'
                  : color === '#FFFFFF'
                    ? '2px dashed #D1D5DB'
                    : '2px solid #D1D5DB',
                transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                boxShadow: selectedColor === color ? '0 0 0 2px #EDE9FE' : 'none',
              }}
              aria-label={label}
            />
          ))}
        </div>
      </div>
        </motion.div>
      )}

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
                <li>Clique em uma regiÃ£o do desenho â€” ou use Tab e Enter â€” para colorir.</li>
                <li>Escolha uma cena bÃ­blica na fila no topo da tela.</li>
                <li>Desfazer remove a Ãºltima pincelada.</li>
                <li>Limpar apaga todas as cores do desenho atual.</li>
                <li>Salvar baixa o SVG com a mensagem e a referÃªncia bÃ­blica.</li>
                <li>Complete todas as regiÃµes para ganhar um selo!</li>
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
              <div className="text-4xl mb-2">ðŸ–¼</div>
              <h2 className="text-lg font-bold mb-1"
                style={{ fontFamily: 'Fredoka One, cursive', color: '#7B5EA7' }}>
                Trocar de Desenho
              </h2>
              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
                Você quer salvar o desenho atual antes de sair?
              </p>
              <div className="flex gap-3">
                <button className="btn-primary flex-1" onClick={() => confirmSwitch(true)}>
                  Salvar e Sair
                </button>
                <button className="btn-secondary flex-1" onClick={() => confirmSwitch(false)}>
                  Sair sem Salvar
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

      {/* ðŸŽ‰ Drawing Completion Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(107,184,255,0.15)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowCelebration(false)}
          >
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="glass-card px-8 py-7 text-center max-w-sm w-full"
              onClick={e => e.stopPropagation()}
              style={{ boxShadow: '0 12px 40px rgba(167,139,250,0.35)' }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ repeat: 2, duration: 0.5 }}
                className="text-6xl mb-3"
              >{drawing.emoji}</motion.div>
              <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: '#A78BFA' }}>
                ðŸŽ‰ Desenho Completo!
              </p>
              <h2 className="text-xl font-black mb-2" style={{ fontFamily: 'Fredoka One, cursive', color: '#5B3A8A' }}>
                {drawing.name}
              </h2>
              <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: '#FFF9E8', border: '1px solid #F4D06F' }}>
                <span className="verse-chip mb-1 inline-block">{drawing.verseRef}</span>
                <p className="text-sm leading-snug font-bold mt-1" style={{ color: '#5B3A8A' }}>{drawing.verseText}</p>
              </div>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => { playSound('click'); setShowCelebration(false) }}
              >
                Continuar Colorindo! ðŸŽ¨
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}


