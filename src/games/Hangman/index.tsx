import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../contexts/PlayerContext';

const WORDS = [
  { word: 'JESUS', hint: 'Filho de Deus, Salvador do mundo' },
  { word: 'MARIA', hint: 'Mãe de Jesus' },
  { word: 'JONAS', hint: 'Foi engolido por um grande peixe' },
  { word: 'NOE', hint: 'Construiu a arca' },
  { word: 'DAVI', hint: 'Derrotou o gigante Golias' },
  { word: 'MOISES', hint: 'Abriu o Mar Vermelho' },
  { word: 'PEDRO', hint: 'Andou sobre as águas' },
  { word: 'PAULO', hint: 'Escreveu várias cartas do Novo Testamento' },
  { word: 'GENESIS', hint: 'Primeiro livro da Bíblia' },
  { word: 'APOCALIPSE', hint: 'Último livro da Bíblia' },
  { word: 'JERUSALEM', hint: 'Cidade Santa' },
  { word: 'BELEM', hint: 'Cidade onde Jesus nasceu' },
  { word: 'CRUZ', hint: 'Símbolo do sacrifício de Jesus' },
  { word: 'BATISMO', hint: 'Realizado no Rio Jordão por João' },
  { word: 'PENTECOSTES', hint: 'Descida do Espírito Santo' },
  { word: 'GOLIAS', hint: 'O gigante filisteu' },
  { word: 'SAMUEL', hint: 'Ouviu a voz de Deus quando era menino' },
  { word: 'DANIEL', hint: 'Foi jogado na cova dos leões' },
  { word: 'SALOMAO', hint: 'O rei mais sábio' },
  { word: 'RUTE', hint: 'Moabita leal à sua sogra Noemi' },
  { word: 'ESTER', hint: 'Rainha que salvou seu povo' },
  { word: 'JOSUE', hint: 'Liderou o povo após Moisés' },
  { word: 'ABRAAO', hint: 'Pai da fé' },
  { word: 'ISAAQUE', hint: 'Filho da promessa de Abraão' },
  { word: 'JACO', hint: 'Teve seu nome mudado para Israel' },
  { word: 'JOSE', hint: 'Governador do Egito, que interpretava sonhos' },
  { word: 'SANSAO', hint: 'Tinha grande força nos cabelos' },
  { word: 'ELIAS', hint: 'Profeta que subiu ao céu num redemoinho' },
  { word: 'ELISEU', hint: 'Sucessor do profeta Elias' },
  { word: 'LUCAS', hint: 'Médico amado, escreveu um Evangelho' }
];

const normalizeStr = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const MAX_MISTAKES = 6;

export default function ForcaBiblica() {
  const navigate = useNavigate();
  const { updateScore } = usePlayer();
  
  const [currentWordObj, setCurrentWordObj] = useState(WORDS[0]);
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [status, setStatus] = useState<'playing'|'won'|'lost'>('playing');

  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = () => {
    const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    setCurrentWordObj(randomWord);
    setGuessedLetters(new Set());
    setMistakes(0);
    setStatus('playing');
  };

  const normalizedWord = normalizeStr(currentWordObj.word);

  const handleGuess = (letter: string) => {
    if (status !== 'playing' || guessedLetters.has(letter)) return;
    
    const newGuessed = new Set(guessedLetters).add(letter);
    setGuessedLetters(newGuessed);

    if (!normalizedWord.includes(letter)) {
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      if (newMistakes >= MAX_MISTAKES) {
        setStatus('lost');
      }
    } else {
      const isWon = normalizedWord.split('').every(c => c === ' ' || newGuessed.has(c));
      if (isWon) {
        setStatus('won');
        updateScore('forca', 10);
      }
    }
  };

  const handleBack = () => navigate('/');

  return (
    <div className="min-h-screen p-4 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/30 backdrop-blur-md shadow text-xl">
          ⬅️
        </button>
        <h1 className="font-title text-2xl" style={{ color: '#F472B6' }}>Forca Bíblica</h1>
        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/30 backdrop-blur-md shadow font-bold text-pink-500">
          🎈
        </div>
      </header>

      {/* Visuals */}
      <div className="glass-card p-4 mb-4 flex flex-col items-center">
        <h2 className="text-sm font-bold uppercase text-gray-500 mb-2">🎈 Salve os Balões 🎈</h2>
        <div className="flex gap-2 justify-center mb-4 min-h-[60px]">
          <AnimatePresence>
            {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: i >= MAX_MISTAKES - mistakes ? 0.3 : 1, 
                  opacity: i >= MAX_MISTAKES - mistakes ? 0.3 : 1,
                  y: i >= MAX_MISTAKES - mistakes ? -20 : 0
                }}
                className="text-4xl"
              >
                🎈
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <p className="text-xs text-gray-400 font-bold">Balões restantes: {MAX_MISTAKES - mistakes}</p>
      </div>

      {/* Hint & Word */}
      <div className="flex-1 flex flex-col justify-center items-center">
        <div className="glass-card p-4 w-full mb-6">
          <p className="text-center font-bold text-purple-600 mb-6 flex flex-col">
            <span className="text-xs uppercase text-gray-400">Dica</span>
            {currentWordObj.hint}
          </p>
          
          <div className="flex flex-wrap gap-2 justify-center">
            {normalizedWord.split('').map((char, index) => {
              const isRevealed = guessedLetters.has(char) || status === 'lost';
              return (
                <div 
                  key={index} 
                  className={`w-10 h-12 flex items-center justify-center text-2xl font-black rounded-lg border-b-4 
                    ${char === ' ' ? 'border-transparent bg-transparent' : 'bg-white shadow border-pink-200 text-pink-600'}
                  `}
                >
                  {char !== ' ' && (
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: isRevealed ? 1 : 0, y: isRevealed ? 0 : 10 }}
                    >
                      {char}
                    </motion.span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Keyboard */}
        <div className="grid grid-cols-7 gap-1.5 w-full mb-6">
          {ALPHABET.map(letter => {
            const isGuessed = guessedLetters.has(letter);
            const isCorrect = isGuessed && normalizedWord.includes(letter);
            const isWrong = isGuessed && !normalizedWord.includes(letter);
            
            let bgClass = "bg-white text-gray-700 shadow border-b-2 border-gray-200 active:border-b-0 active:translate-y-[2px]";
            if (isCorrect) bgClass = "bg-green-400 text-white shadow-inner";
            if (isWrong) bgClass = "bg-gray-200 text-gray-400 shadow-inner";

            return (
              <button
                key={letter}
                onClick={() => handleGuess(letter)}
                disabled={isGuessed || status !== 'playing'}
                className={`h-12 rounded-lg font-black text-lg transition-all flex items-center justify-center ${bgClass}`}
              >
                {letter}
              </button>
            )
          })}
        </div>
      </div>

      {/* End Game Modal */}
      <AnimatePresence>
        {status !== 'playing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-card w-full max-w-sm p-6 text-center bg-white"
            >
              <div className="text-6xl mb-4">{status === 'won' ? '🎉' : '💥'}</div>
              <h2 className={`font-title text-3xl mb-2 ${status === 'won' ? 'text-green-500' : 'text-red-500'}`}>
                {status === 'won' ? 'Parabéns!' : 'Puxa vida!'}
              </h2>
              <p className="text-gray-600 mb-6">
                A palavra era: <strong className="text-xl text-purple-600 block mt-2">{currentWordObj.word}</strong>
              </p>
              
              <button
                onClick={startNewGame}
                className="w-full py-4 rounded-2xl text-white font-black text-lg shadow-lg"
                style={{ background: 'linear-gradient(135deg, #F472B6, #A78BFA)' }}
              >
                Jogar Novamente
              </button>
              <button
                onClick={handleBack}
                className="w-full mt-3 py-3 rounded-2xl text-gray-600 font-bold text-sm bg-gray-100"
              >
                Voltar ao Início
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
