const fs = require('fs');
const path = require('path');

const memoryPairsPath = path.join('C:', 'Users', 'danie', 'Desktop', 'mel', 'src', 'data', 'memoryPairs.json');
const quizQuestionsPath = path.join('C:', 'Users', 'danie', 'Desktop', 'mel', 'src', 'data', 'quizQuestions.json');

const newPairs = [
  {"id": "jonah", "emoji": "🐋", "title": "Jonas", "verseRef": "Jonas 2:1", "message": "Deus ouviu a oração de Jonas e o salvou."},
  {"id": "samson", "emoji": "💪", "title": "Sansão", "verseRef": "Juízes 16:17", "message": "Deus deu a Sansão uma força impressionante."},
  {"id": "david_harp", "emoji": "🎸", "title": "Davi", "verseRef": "1 Samuel 16:23", "message": "Davi tocava para acalmar o coração do rei."},
  {"id": "water_wine", "emoji": "💧", "title": "Água em Vinho", "verseRef": "João 2:11", "message": "Jesus transformou a água no melhor vinho."},
  {"id": "walk_water", "emoji": "🚶", "title": "Andando na Água", "verseRef": "Mateus 14:25", "message": "Jesus andou sobre o mar e acalmou a tempestade."},
  {"id": "fruit_love", "emoji": "🍎", "title": "Fruto do Espírito", "verseRef": "Gálatas 5:22", "message": "O Espírito Santo nos ensina a amar."},
  {"id": "moses_sea", "emoji": "🌊", "title": "Mar Vermelho", "verseRef": "Êxodo 14:21", "message": "Deus abriu o mar para o seu povo passar em segurança."},
  {"id": "burning_bush", "emoji": "🔥", "title": "Sarça Ardente", "verseRef": "Êxodo 3:2", "message": "Deus falou com Moisés através do fogo que não apagava."},
  {"id": "ten_commandments", "emoji": "📜", "title": "Dez Mandamentos", "verseRef": "Êxodo 20:1", "message": "Deus deu regras para nos proteger e nos guiar."},
  {"id": "jericho", "emoji": "🎺", "title": "Muralhas de Jericó", "verseRef": "Josué 6:20", "message": "Com gritos e trombetas, as muralhas caíram."},
  {"id": "goliath", "emoji": "🪨", "title": "Davi e Golias", "verseRef": "1 Samuel 17:50", "message": "Davi derrotou o gigante confiando em Deus."},
  {"id": "elijah_fire", "emoji": "⚡", "title": "Fogo do Céu", "verseRef": "1 Reis 18:38", "message": "Deus respondeu a Elias mandando fogo do céu."},
  {"id": "esther", "emoji": "👑", "title": "Rainha Ester", "verseRef": "Ester 4:14", "message": "Ester foi corajosa para salvar o seu povo."},
  {"id": "daniel_pray", "emoji": "🙏", "title": "Daniel", "verseRef": "Daniel 6:10", "message": "Daniel orava a Deus três vezes ao dia."},
  {"id": "furnace", "emoji": "♨️", "title": "Fornalha de Fogo", "verseRef": "Daniel 3:25", "message": "Deus protegeu os três amigos do rei malvado."},
  {"id": "blind_bartimaeus", "emoji": "👁️", "title": "Cura do Cego", "verseRef": "Marcos 10:52", "message": "Jesus curou o cego que teve muita fé."},
  {"id": "lost_sheep", "emoji": "🐑", "title": "A Ovelha Perdida", "verseRef": "Lucas 15:6", "message": "Jesus nos busca como um pastor busca sua ovelhinha."},
  {"id": "good_samaritan", "emoji": "🩹", "title": "O Bom Samaritano", "verseRef": "Lucas 10:33", "message": "Devemos ajudar todas as pessoas com amor."},
  {"id": "prodigal_son", "emoji": "🏠", "title": "O Filho Pródigo", "verseRef": "Lucas 15:20", "message": "Deus é um Pai que nos perdoa e nos recebe de volta."},
  {"id": "zacchaeus", "emoji": "🌳", "title": "Zaqueu", "verseRef": "Lucas 19:4", "message": "Zaqueu subiu na árvore para ver Jesus."},
  {"id": "lazarus", "emoji": "🪦", "title": "Lázaro", "verseRef": "João 11:43", "message": "Jesus mostrou que tem o poder de dar a vida."},
  {"id": "mary_martha", "emoji": "🧹", "title": "Maria e Marta", "verseRef": "Lucas 10:41", "message": "O mais importante é ouvir as palavras de Jesus."},
  {"id": "last_supper", "emoji": "🍇", "title": "A Última Ceia", "verseRef": "Mateus 26:26", "message": "Jesus repartiu o pão e o vinho com seus amigos."},
  {"id": "empty_tomb", "emoji": "🌅", "title": "O Túmulo Vazio", "verseRef": "Lucas 24:3", "message": "Ele não está aqui, ele ressuscitou!"},
  {"id": "pentecost", "emoji": "🌬️", "title": "Pentecostes", "verseRef": "Atos 2:4", "message": "O Espírito Santo encheu a todos de coragem."},
  {"id": "paul_shipwreck", "emoji": "⛵", "title": "O Barco de Paulo", "verseRef": "Atos 27:44", "message": "Deus protegeu Paulo durante a grande tempestade."},
  {"id": "armor_god", "emoji": "🛡️", "title": "Armadura de Deus", "verseRef": "Efésios 6:11", "message": "Use a armadura de Deus para se proteger do mal."},
  {"id": "tree_life", "emoji": "🌱", "title": "Árvore da Vida", "verseRef": "Apocalipse 22:2", "message": "No céu, a árvore da vida trará cura para todos."},
  {"id": "new_jerusalem", "emoji": "🏰", "title": "Nova Jerusalém", "verseRef": "Apocalipse 21:2", "message": "Deus preparou uma cidade linda para nós."},
  {"id": "no_more_tears", "emoji": "😊", "title": "Alegria Eterna", "verseRef": "Apocalipse 21:4", "message": "Deus enxugará de nossos olhos todas as lágrimas."}
];

const newQuestions = [
  { "question": "O que Jesus fez na festa de casamento em Caná?", "options": ["Curou um cego", "Transformou água em vinho", "Multiplicou os pães", "Andou sobre as águas"], "correct": 1, "category": "Milagres de Jesus", "verseRef": "João 2:11", "verseText": "Jesus fez esse seu primeiro milagre em Caná da Galileia. Assim ele revelou a sua natureza divina...", "explanation": "Jesus demonstrou seu poder e transformou água no melhor vinho." },
  { "question": "Quem Jesus curou ao tocar em seus olhos?", "options": ["Um mudo", "Um paralítico", "Um cego", "Um surdo"], "correct": 2, "category": "Milagres de Jesus", "verseRef": "João 9:6-7", "verseText": "Ele cuspiu no chão, fez lama com a saliva, passou a lama nos olhos do cego e disse: — Vá lavar o rosto no tanque de Siloé.", "explanation": "Jesus deu a visão a um homem que nasceu cego." },
  { "question": "Como Jesus ajudou Pedro a pagar o imposto?", "options": ["Deu-lhe dinheiro", "Mandou pescar um peixe", "Pediu esmola", "Vendeu o barco"], "correct": 1, "category": "Milagres de Jesus", "verseRef": "Mateus 17:27", "verseText": "Mas, para não ofender essa gente, vá ao lago, jogue o anzol e puxe o primeiro peixe que você fisgar. Na boca dele você achará uma moeda...", "explanation": "Jesus providenciou exatamente a quantia certa dentro da boca de um peixe!" },
  { "question": "O que aconteceu quando Jesus tocou na orelha do servo do Grande Sacerdote?", "options": ["Ele gritou", "A orelha caiu", "A orelha foi curada", "Ele ficou surdo"], "correct": 2, "category": "Milagres de Jesus", "verseRef": "Lucas 22:51", "verseText": "Mas Jesus disse: — Parem com isso! Então tocou na orelha do homem e o curou.", "explanation": "Mesmo sendo preso, Jesus curou o ferimento daquele homem." },
  { "question": "Quem Jesus fez levantar de uma maca e andar?", "options": ["O cego de nascença", "Um paralítico", "O filho da viúva", "Zaqueu"], "correct": 1, "category": "Milagres de Jesus", "verseRef": "Marcos 2:11", "verseText": "— Eu digo a você: levante-se, pegue a sua cama e vá para casa!", "explanation": "Jesus perdoou seus pecados e o curou." },
  { "question": "Como Jesus acalmou a grande tempestade no lago?", "options": ["Comandou o vento e a água", "Pegou um remo maior", "Pediu ajuda a Pedro", "Pulou do barco"], "correct": 0, "category": "Milagres de Jesus", "verseRef": "Marcos 4:39", "verseText": "Então ele se levantou, falou duro com o vento e disse ao lago: — Silêncio! Fique quieto! O vento parou, e tudo ficou calmo.", "explanation": "Jesus tem poder sobre toda a natureza." },
  { "question": "Quem Jesus ressuscitou na cidade de Naim?", "options": ["Lázaro", "A filha de Jairo", "O filho de uma viúva", "Um rei"], "correct": 2, "category": "Milagres de Jesus", "verseRef": "Lucas 7:14-15", "verseText": "Aí ele chegou mais perto e tocou no caixão. ... Então disse: — Moço, eu ordeno a você: levante-se! O moço sentou-se e começou a falar...", "explanation": "Jesus sentiu muita pena daquela viúva e devolveu a vida ao filho dela." },
  { "question": "Onde aconteceu a primeira pesca maravilhosa?", "options": ["No Rio Jordão", "No Mar Vermelho", "No Lago da Galileia", "No Mar Morto"], "correct": 2, "category": "Milagres de Jesus", "verseRef": "Lucas 5:4-6", "verseText": "Leve o barco para o lugar onde o lago é fundo e joguem as redes para pescar. ... Eles fizeram isso e apanharam tanto peixe, que as redes estavam se rebentando.", "explanation": "Pedro confiou na palavra de Jesus e pescou uma quantidade enorme de peixes." },
  { "question": "O que aconteceu à figueira quando Jesus não encontrou frutos nela?", "options": ["Ela deu maçãs", "Ela ficou cheia de flores", "Ela secou na mesma hora", "Ela cresceu mais"], "correct": 2, "category": "Milagres de Jesus", "verseRef": "Mateus 21:19", "verseText": "Disse a ela: — Nunca mais dê figos! E na mesma hora a figueira secou.", "explanation": "Esse milagre mostrou aos discípulos o poder da palavra de Jesus." },
  { "question": "Quantos leprosos voltaram para agradecer a Jesus depois de curados?", "options": ["Dez", "Um", "Nenhum", "Sete"], "correct": 1, "category": "Milagres de Jesus", "verseRef": "Lucas 17:15-16", "verseText": "Quando um deles, que era samaritano, viu que estava curado, voltou louvando a Deus em voz alta. Ajoelhou-se aos pés de Jesus e lhe agradeceu.", "explanation": "Dos dez que foram curados, apenas um lembrou de voltar para agradecer." },
  { "question": "Quem foi chamado de 'amigo de Deus' e acreditou que sua família seria grande como as estrelas?", "options": ["Noé", "Davi", "Abraão", "Paulo"], "correct": 2, "category": "Heróis da Fé", "verseRef": "Gênesis 15:5-6", "verseText": "Ele levou Abrão para fora e disse: — Olhe para o céu e conte as estrelas se puder. Pois bem! Será esse o número dos seus descendentes. Abrão creu em Deus, o Senhor...", "explanation": "Abraão teve muita fé e confiou na promessa." },
  { "question": "Qual heroína escondeu os espiões em Jericó?", "options": ["Raabe", "Ester", "Débora", "Rute"], "correct": 0, "category": "Heróis da Fé", "verseRef": "Josué 2:1", "verseText": "Os dois foram e entraram na casa de uma prostituta chamada Raabe e passaram a noite ali.", "explanation": "A coragem de Raabe ajudou os israelitas e ela foi salva." },
  { "question": "Qual profeta subiu ao céu em um redemoinho com uma carruagem de fogo?", "options": ["Elias", "Isaías", "Jeremias", "Eliseu"], "correct": 0, "category": "Heróis da Fé", "verseRef": "2 Reis 2:11", "verseText": "De repente, uma carruagem de fogo puxada por cavalos de fogo os separou um do outro, e Elias foi levado para o céu num redemoinho.", "explanation": "Deus levou Elias vivo para o céu de forma extraordinária." },
  { "question": "Quem liderou o povo de Israel após a morte de Moisés?", "options": ["Gideão", "Arão", "Josué", "Elias"], "correct": 2, "category": "Heróis da Fé", "verseRef": "Josué 1:1-2", "verseText": "Depois da morte de Moisés, ... o Senhor Deus falou com o ajudante de Moisés. O nome dele era Josué. Deus disse: — O meu servo Moisés está morto. Agora você e todo o povo de Israel se preparem para atravessar o rio Jordão...", "explanation": "Josué foi o líder corajoso escolhido por Deus." },
  { "question": "Quem foi a juíza guerreira de Israel que se sentava debaixo de uma palmeira?", "options": ["Miriã", "Débora", "Sara", "Raquel"], "correct": 1, "category": "Heróis da Fé", "verseRef": "Juízes 4:4-5", "verseText": "Nesse tempo uma profetisa chamada Débora, mulher de Lapidote, era juíza de Israel. Ela costumava sentar-se debaixo de uma palmeira...", "explanation": "Débora ajudou a liderar o povo para a vitória contra seus inimigos." },
  { "question": "Com quantos soldados Gideão derrotou o grande exército midianita?", "options": ["Dez mil", "Trezentos", "Três mil", "Cem"], "correct": 1, "category": "Heróis da Fé", "verseRef": "Juízes 7:7", "verseText": "Aí o Senhor disse a Gideão: — Com estes trezentos homens que lamberam a água, eu libertarei vocês e lhes darei a vitória sobre os midianitas...", "explanation": "Deus mostrou que a vitória vem dEle, não do número de soldados." },
  { "question": "Quem ungia os primeiros reis de Israel, derramando azeite sobre a cabeça deles?", "options": ["Samuel", "Isaías", "Natã", "Ezequiel"], "correct": 0, "category": "Heróis da Fé", "verseRef": "1 Samuel 10:1", "verseText": "Aí Samuel pegou um frasco de azeite e derramou na cabeça de Saul. Beijou-o e disse: — O Senhor Deus está ungindo você para ser o chefe do seu povo...", "explanation": "Samuel foi um profeta e juiz fiel a Deus desde a infância." },
  { "question": "Qual era a profissão de Davi antes de se tornar rei?", "options": ["Carpinteiro", "Ferreiro", "Pescador", "Pastor de ovelhas"], "correct": 3, "category": "Heróis da Fé", "verseRef": "1 Samuel 16:11", "verseText": "— Eles estão todos aqui? — perguntou Samuel. Jessé respondeu: — Falta o caçula, que está cuidando das ovelhas.", "explanation": "Davi cuidava das ovelhinhas do seu pai e aprendeu a cuidar delas." },
  { "question": "Quem ajudou a reconstruir os muros de Jerusalém enfrentando ameaças?", "options": ["Neemias", "Esdras", "Jeremias", "Malaquias"], "correct": 0, "category": "Heróis da Fé", "verseRef": "Neemias 6:15", "verseText": "A reconstrução da muralha foi terminada no dia vinte e cinco do mês de elul. A obra toda demorou cinquenta e dois dias.", "explanation": "Neemias orou a Deus e trabalhou com dedicação." },
  { "question": "Quem foi o jovem levado para a Babilônia que interpretava os sonhos do rei?", "options": ["José", "Daniel", "Ezequiel", "Sadraque"], "correct": 1, "category": "Heróis da Fé", "verseRef": "Daniel 2:19", "verseText": "Naquela noite, Daniel teve uma visão, e nela Deus lhe explicou o mistério. Então Daniel louvou o Deus do céu...", "explanation": "Deus deu sabedoria a Daniel para entender coisas muito difíceis." },
  { "question": "Segundo o livro de Provérbios, o que devemos guardar mais do que qualquer outra coisa?", "options": ["O nosso tesouro", "O nosso coração", "A nossa casa", "Os nossos brinquedos"], "correct": 1, "category": "Provérbios", "verseRef": "Provérbios 4:23", "verseText": "Tenha cuidado com o que você pensa, pois a sua vida é dirigida pelos seus pensamentos.", "explanation": "Nossos sentimentos e pensamentos dirigem nossas ações." },
  { "question": "O que afasta a raiva?", "options": ["Um grito forte", "Uma cara fechada", "Uma resposta delicada", "Correr longe"], "correct": 2, "category": "Provérbios", "verseRef": "Provérbios 15:1", "verseText": "A resposta delicada acalma o furor, mas a palavra dura aumenta a raiva.", "explanation": "Falar com calma e carinho ajuda a resolver brigas." },
  { "question": "A quem a formiga é apresentada como exemplo?", "options": ["Ao dorminhoco", "Ao corajoso", "Ao inteligente", "Ao preguiçoso"], "correct": 3, "category": "Provérbios", "verseRef": "Provérbios 6:6", "verseText": "Preguiçoso, aprenda uma lição com as formigas! Elas não têm líder, nem chefe, nem governador, mas guardam comida no verão...", "explanation": "As formigas são muito trabalhadoras e se preparam para o futuro." },
  { "question": "O que é melhor ter do que muitas riquezas?", "options": ["Uma casa grande", "A paz e o amor", "Um exército forte", "Tornar-se famoso"], "correct": 1, "category": "Provérbios", "verseRef": "Provérbios 15:17", "verseText": "É melhor comer verduras na companhia de quem a gente ama do que comer a carne mais deliciosa onde existe ódio.", "explanation": "O amor é mais importante e valioso que qualquer riqueza." },
  { "question": "O que acontece com quem anda com os sábios?", "options": ["Fica pobre", "Torna-se sábio", "Fica orgulhoso", "Ganha presentes"], "correct": 1, "category": "Provérbios", "verseRef": "Provérbios 13:20", "verseText": "Quem anda com os sábios será sábio, mas quem anda com os tolos acabará mal.", "explanation": "As amizades influenciam muito em como somos e o que fazemos." },
  { "question": "O que alegra o coração humano, segundo Provérbios 17:22?", "options": ["Muitos doces", "Um coração alegre", "Um dia ensolarado", "Uma festa longa"], "correct": 1, "category": "Provérbios", "verseRef": "Provérbios 17:22", "verseText": "A alegria faz bem à saúde; estar sempre triste é morrer aos poucos.", "explanation": "Estar feliz e alegre é como um bom remédio para o corpo." },
  { "question": "Onde o caminho de Deus é comparado à luz que brilha mais e mais?", "options": ["No caminho dos ímpios", "Na subida da montanha", "No caminho dos justos", "Nas ruas das cidades"], "correct": 2, "category": "Provérbios", "verseRef": "Provérbios 4:18", "verseText": "O caminho dos justos é como a primeira luz da manhã, que brilha cada vez mais até virar luz do dia.", "explanation": "Fazer o que é certo nos leva a uma vida mais iluminada e bonita." },
  { "question": "Segundo Provérbios, o que o amigo de verdade faz?", "options": ["Nunca nos corrige", "Fica calado", "Nos abandona na dor", "Ama em todos os momentos"], "correct": 3, "category": "Provérbios", "verseRef": "Provérbios 17:17", "verseText": "O amigo ama sempre e na desgraça ele se torna um irmão.", "explanation": "O amor verdadeiro aparece nas horas difíceis." },
  { "question": "O que o orgulho atrai para a pessoa?", "options": ["Sabedoria", "A queda e o fracasso", "Muitos amigos", "Bênçãos e poder"], "correct": 1, "category": "Provérbios", "verseRef": "Provérbios 16:18", "verseText": "O orgulho leva à destruição, e a vaidade faz cair na desgraça.", "explanation": "Achar que se é melhor que os outros é perigoso." },
  { "question": "O que é mais precioso do que rubis e pedras finas?", "options": ["A sabedoria", "O ouro", "A prata", "O bronze"], "correct": 0, "category": "Provérbios", "verseRef": "Provérbios 8:11", "verseText": "Pois a sabedoria é melhor do que as joias; tudo o que você deseja não pode se comparar com ela.", "explanation": "Conhecer e obedecer a Deus é a maior riqueza." }
];

let pairsData = [];
try {
  const content = fs.readFileSync(memoryPairsPath, 'utf8');
  pairsData = JSON.parse(content);
} catch (e) {
  console.error('Error reading memoryPairs.json:', e);
}

pairsData = pairsData.concat(newPairs);
fs.writeFileSync(memoryPairsPath, JSON.stringify(pairsData, null, 2), 'utf8');
console.log('Successfully updated memoryPairs.json');

let quizData = [];
try {
  const content = fs.readFileSync(quizQuestionsPath, 'utf8');
  quizData = JSON.parse(content);
} catch (e) {
  console.error('Error reading quizQuestions.json:', e);
}

quizData = quizData.concat(newQuestions);
fs.writeFileSync(quizQuestionsPath, JSON.stringify(quizData, null, 2), 'utf8');
console.log('Successfully updated quizQuestions.json');
