const QUESTIONS_URL = 'assets/questions.json';

let fullDatabase = [];
let currentQueue = [];
let currentIndex = 0;
let userAnswers = {};
let qStatus = {};

const KEY_SAVED = 'quiz_ind_saved';
const KEY_ERRORS = 'quiz_ind_errors';
let savedIDs = JSON.parse(localStorage.getItem(KEY_SAVED)) || [];
let errorIDs = JSON.parse(localStorage.getItem(KEY_ERRORS)) || [];

document.addEventListener('DOMContentLoaded', () => {
    loadQuestions();
});

async function loadQuestions() {
    try {
        const res = await fetch(QUESTIONS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fullDatabase = await res.json();
        document.getElementById('total-display').innerText = fullDatabase.length;
        applyFilter();
    } catch (err) {
        showLoadError(err);
    }
}

function showLoadError(err) {
    const qText = document.getElementById('q-text');
    const optContainer = document.getElementById('options-container');
    qText.innerText = 'Errore nel caricamento del dataset.';
    optContainer.innerHTML = '<div class="alert alert-danger mb-0" role="alert">Impossibile caricare le domande. Riprova a ricaricare la pagina.</div>';
    console.error('Load error', err);
}

function applyFilter() {
    const filter = document.getElementById('filter-select').value;
    const isRandom = document.getElementById('check-random').checked;

    document.getElementById('quiz-view').style.display = 'block';
    document.getElementById('results-view').style.display = 'none';
    document.getElementById('footer-controls').style.display = 'flex';

    let subset = [];

    if (filter === 'all') {
        subset = [...fullDatabase];
        document.getElementById('filter-status').innerText = 'Tutti i quiz';
    } else if (filter === 'saved') {
        subset = fullDatabase.filter(q => savedIDs.includes(q.id));
        document.getElementById('filter-status').innerText = 'Solo salvati';
    } else if (filter === 'errors') {
        subset = fullDatabase.filter(q => errorIDs.includes(q.id));
        document.getElementById('filter-status').innerText = 'Solo sbagliati';
    }

    if (isRandom) {
        shuffle(subset);
    } else {
        subset.sort((a, b) => a.id - b.id);
    }

    currentQueue = subset;
    currentIndex = 0;

    renderScroller();

    if (currentQueue.length > 0) {
        loadQuestion(0);
    } else {
        document.getElementById('q-text').innerText = 'Nessuna domanda trovata con questo filtro.';
        document.getElementById('options-container').innerHTML = '';
    }

    document.getElementById('total-display').innerText = currentQueue.length;
}

function restartQuiz() {
    userAnswers = {};
    qStatus = {};
    applyFilter();
}

function setFilter(val) {
    document.getElementById('filter-select').value = val;
    applyFilter();
}

function renderScroller() {
    const container = document.getElementById('nav-scroller');
    container.innerHTML = '';

    currentQueue.forEach((q, idx) => {
        const btn = document.createElement('div');
        btn.className = 'q-btn';
        btn.innerText = idx + 1;
        btn.onclick = () => loadQuestion(idx);
        btn.id = `nav-btn-${idx}`;
        if (savedIDs.includes(q.id)) {
            btn.classList.add('is-saved');
        }
        container.appendChild(btn);
    });
}

function loadQuestion(index) {
    if (index < 0 || index >= currentQueue.length) return;
    currentIndex = index;
    const q = currentQueue[currentIndex];

    document.getElementById('idx-display').innerText = index + 1;
    document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
    const currBtn = document.getElementById(`nav-btn-${index}`);
    if (currBtn) currBtn.classList.add('active');

    document.getElementById('q-id-display').innerText = q.id;
    document.getElementById('cat-badge').innerText = q.c.toUpperCase();
    document.getElementById('q-text').innerText = q.q;

    const optContainer = document.getElementById('options-container');
    optContainer.innerHTML = '';

    q.o.forEach((optText, i) => {
        const div = document.createElement('div');
        div.className = 'option-item';
        div.onclick = () => selectOption(q.id, i);

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'q-opt';
        radio.checked = (userAnswers[q.id] === i);

        const span = document.createElement('span');
        span.className = 'option-text';
        span.innerText = optText;

        div.appendChild(radio);
        div.appendChild(span);
        optContainer.appendChild(div);
    });

    document.getElementById('scientific-note').style.display = 'none';
    updateSaveIcon();

    if (qStatus[q.id]) {
        showFeedback(q.id);
    }

    const btnNext = document.getElementById('btn-next');
    if (index === currentQueue.length - 1) {
        btnNext.innerHTML = 'Consegna <i class="fas fa-check-circle ms-1"></i>';
        btnNext.className = 'btn btn-success px-4';
        btnNext.onclick = finishQuiz;
    } else {
        btnNext.innerHTML = 'Avanti';
        btnNext.className = 'btn btn-primary px-4';
        btnNext.onclick = nextQ;
    }
}

function selectOption(qId, optIndex) {
    userAnswers[qId] = optIndex;
    const radios = document.getElementsByName('q-opt');
    if (radios[optIndex]) radios[optIndex].checked = true;

    if (document.getElementById('check-instant').checked) {
        checkAnswer();
    }
}

function checkAnswer() {
    const q = currentQueue[currentIndex];
    if (userAnswers[q.id] === undefined) return;

    const selected = userAnswers[q.id];
    const isCorrect = (selected === q.a);

    qStatus[q.id] = isCorrect ? 'correct' : 'wrong';

    if (!isCorrect) {
        if (!errorIDs.includes(q.id)) {
            errorIDs.push(q.id);
            localStorage.setItem(KEY_ERRORS, JSON.stringify(errorIDs));
        }
    } else {
        if (errorIDs.includes(q.id)) {
            errorIDs = errorIDs.filter(id => id !== q.id);
            localStorage.setItem(KEY_ERRORS, JSON.stringify(errorIDs));
        }
    }

    showFeedback(q.id);
    updateScrollerStatus(currentIndex, isCorrect);

    if (q.note && q.note.trim() !== '') {
        document.getElementById('note-text').innerHTML = '<strong>Nota Scientifica:</strong> ' + q.note;
        document.getElementById('scientific-note').style.display = 'block';
    }
}

function showFeedback(qId) {
    const q = currentQueue[currentIndex];
    if (q.id !== qId) return;

    const opts = document.querySelectorAll('.option-item');
    opts.forEach((div, i) => {
        div.classList.remove('correct-bg', 'wrong-bg');
        if (i === q.a) {
            div.classList.add('correct-bg');
        }
        if (userAnswers[qId] === i && i !== q.a) {
            div.classList.add('wrong-bg');
        }
    });
}

function updateScrollerStatus(idx, isCorrect) {
    if (!document.getElementById('check-navcolor').checked) return;
    const btn = document.getElementById(`nav-btn-${idx}`);
    if (btn) {
        btn.classList.remove('is-correct', 'is-wrong');
        btn.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
    }
}

function toggleSave() {
    const q = currentQueue[currentIndex];
    const idx = savedIDs.indexOf(q.id);

    if (idx === -1) {
        savedIDs.push(q.id);
    } else {
        savedIDs.splice(idx, 1);
    }
    localStorage.setItem(KEY_SAVED, JSON.stringify(savedIDs));
    updateSaveIcon();

    const btn = document.getElementById(`nav-btn-${currentIndex}`);
    if (btn) btn.classList.toggle('is-saved');
}

function updateSaveIcon() {
    const q = currentQueue[currentIndex];
    const btn = document.getElementById('btn-save');
    if (savedIDs.includes(q.id)) {
        btn.classList.add('is-active');
        btn.innerHTML = '<i class="fas fa-star"></i>';
    } else {
        btn.classList.remove('is-active');
        btn.innerHTML = '<i class="far fa-star"></i>';
    }
}

function nextQ() {
    if (currentIndex < currentQueue.length - 1) loadQuestion(currentIndex + 1);
}

function prevQ() {
    if (currentIndex > 0) loadQuestion(currentIndex - 1);
}

function finishQuiz() {
    let correctCount = 0;
    let answeredCount = 0;

    currentQueue.forEach(q => {
        if (qStatus[q.id]) {
            answeredCount++;
            if (qStatus[q.id] === 'correct') correctCount++;
        }
    });

    const total = currentQueue.length;
    const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    document.getElementById('quiz-view').style.display = 'none';
    document.getElementById('footer-controls').style.display = 'none';
    const resView = document.getElementById('results-view');
    resView.style.display = 'block';

    const circle = document.getElementById('score-circle');
    circle.innerText = `${percentage}%`;

    if (percentage >= 80) circle.style.background = '#198754';
    else if (percentage >= 60) circle.style.background = '#ffc107';
    else circle.style.background = '#dc3545';

    document.getElementById('score-details').innerText = `Hai risposto correttamente a ${correctCount} domande su ${total}.`;
}

function toggleInstant() {
    // Placeholder per future estensioni
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
