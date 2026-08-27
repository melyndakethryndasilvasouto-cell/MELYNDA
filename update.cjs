const fs = require('fs');

// 1. Update gameMissions.json
const gmPath = 'C:/Users/danie/Desktop/mel/src/data/gameMissions.json';
let gm = JSON.parse(fs.readFileSync(gmPath, 'utf8'));
if (!gm.find(g => g.gameId === 'forca')) {
  gm.push({
    path: '/forca',
    gameId: 'forca',
    homeName: 'Forca Bíblica',
    homeDescription: 'Descubra a palavra e salve os balões!',
    icon: '🎈',
    theme: 'Palavras da Bíblia',
    verseRef: 'Salmo 119:130',
    message: 'A explicação da tua palavra traz luz e dá sabedoria aos simples.',
    challenge: 'Tente adivinhar a palavra bíblica com paciência e aprendizado.'
  });
  fs.writeFileSync(gmPath, JSON.stringify(gm, null, 2));
}

// 2. Update HomePage.tsx
const hpPath = 'C:/Users/danie/Desktop/mel/src/components/Home/HomePage.tsx';
let hp = fs.readFileSync(hpPath, 'utf8');
if (!hp.includes('forca: {')) {
  hp = hp.replace(
    /pong:.*$/m,
    match => match + '\n  forca: { grad: \'linear-gradient(135deg,#F472B6,#F59E0B)\' },'
  );
  fs.writeFileSync(hpPath, hp);
}

// 3. Update App.tsx
const appPath = 'C:/Users/danie/Desktop/mel/src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');
if (!app.includes('Forca')) {
  app = app.replace(
    /const Pong.*$/m,
    match => match + '\nconst Forca        = lazy(() => import(\'./games/Hangman\'))'
  );
  app = app.replace(
    /<Route path="\/pong".*$/m,
    match => match + '\n            <Route path="/forca" element={<Forca />} />'
  );
  fs.writeFileSync(appPath, app);
}
