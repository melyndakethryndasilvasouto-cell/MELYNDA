import json

path = 'C:/Users/danie/Desktop/mel/src/games/ColorBook/index.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.read()

# 1. State vars
state_search = """  const [drawingIdx, setDrawingIdx] = useState(0)
  const [selectedColor, setSelectedColor] = useState('#EF4444')"""
state_repl = """  const [drawingIdx, setDrawingIdx] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'drawing'>('grid')
  const [activeCategory, setActiveCategory] = useState<'bible' | 'mandala'>('bible')
  const [selectedColor, setSelectedColor] = useState('#EF4444')"""

lines = lines.replace(state_search, state_repl)

# 2. requestSwitch and confirmSwitch
switch_search = """  const requestSwitch = (idx: number) => {
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
  }"""

switch_repl = """  const requestSwitch = (idx: number) => {
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
  }"""

lines = lines.replace(switch_search, switch_repl)

# 3. UI
ui_search = """      {/* Header */}
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
          {(DRAWINGS.concat(MANDALA_DRAWINGS)).map((d, i) => (
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
      <div className="flex-1 min-h-0 px-2">"""

ui_repl = """      {/* Header */}
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
          <div className="flex-1 min-h-0 px-2">"""

if ui_search in lines:
    lines = lines.replace(ui_search, ui_repl)
else:
    print('UI SEARCH NOT FOUND')

# 4. Close the motion.div
close_search = """              aria-label={label}
            />
          ))}
        </div>
      </div>

      {/* Help Modal */}"""

close_repl = """              aria-label={label}
            />
          ))}
        </div>
      </div>
        </motion.div>
      )}

      {/* Help Modal */}"""

if close_search in lines:
    lines = lines.replace(close_search, close_repl)
else:
    print('CLOSE SEARCH NOT FOUND')

# 5. Fix switchModal text
modal_search = """              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
                Voce quer salvar o desenho atual antes de trocar?
              </p>
              <div className="flex gap-3">
                <button className="btn-primary flex-1" onClick={() => confirmSwitch(true)}>
                  Salvar e Trocar
                </button>
                <button className="btn-secondary flex-1" onClick={() => confirmSwitch(false)}>
                  Trocar sem Salvar
                </button>
              </div>"""

modal_repl = """              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
                Você quer salvar o desenho atual antes de sair?
              </p>
              <div className="flex gap-3">
                <button className="btn-primary flex-1" onClick={() => confirmSwitch(true)}>
                  Salvar e Sair
                </button>
                <button className="btn-secondary flex-1" onClick={() => confirmSwitch(false)}>
                  Sair sem Salvar
                </button>
              </div>"""

if modal_search in lines:
    lines = lines.replace(modal_search, modal_repl)
else:
    print('MODAL SEARCH NOT FOUND')

with open(path, 'w', encoding='utf-8') as f:
    f.write(lines)

print("Done")
