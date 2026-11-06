import './style.css';
import { BANDE, POINT_FIXE, decalage, etatBande, heure } from './enregistrement.js';

// Bouton « Copier » de l'adresse des extensions. Sans presse-papiers, il reste caché
// et l'adresse se sélectionne à la main.
for (const bouton of document.querySelectorAll('[data-copier]')) {
  const cible = document.getElementById(bouton.dataset.copier);
  if (!cible || !navigator.clipboard) continue;

  const libelle = bouton.textContent;
  let minuteur;
  bouton.hidden = false;
  bouton.addEventListener('click', async () => {
    clearTimeout(minuteur);
    try {
      await navigator.clipboard.writeText(cible.innerText.trim());
      bouton.textContent = 'Copié';
    } catch {
      const plage = document.createRange();
      plage.selectNodeContents(cible);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(plage);
      bouton.textContent = 'Sélectionnée, copiez-la';
    }
    minuteur = setTimeout(() => { bouton.textContent = libelle; }, 2500);
  });
}

// La bande du premier écran : le papier défile sous les plumes. Sans JavaScript, ou si le
// visiteur a demandé moins d'animations, elle reste sur l'image fixe écrite au build.
function bande() {
  const figure = document.querySelector('[data-bande]');
  if (!figure) return;
  const papier = figure.querySelector('.bande-papier');
  const plumes = [...figure.querySelectorAll('.plume')];
  const lectureHeure = figure.querySelector('[data-lecture="heure"]');
  const lectureTwitch = figure.querySelector('[data-lecture="twitch"]');
  const lectureRonflux = figure.querySelector('[data-lecture="ronflux"]');
  const pause = figure.querySelector('[data-pause]');
  if (!papier || plumes.length !== 3 || !lectureHeure || !lectureTwitch || !lectureRonflux || !pause) return;

  const moinsAnimer = window.matchMedia('(prefers-reduced-motion: reduce)');
  let ecoule = 0; // pixels de papier défilés depuis POINT_FIXE
  let enPub = true;
  let heureAffichee = lectureHeure.textContent;
  let visible = true;
  let enPause = false;
  let precedent = null;
  let image = 0;

  function dessiner() {
    const p = POINT_FIXE + ecoule;
    papier.style.transform = `translate3d(${decalage(ecoule)}px, 0, 0)`;

    const etat = etatBande(p);
    etat.plumes.forEach((y, i) => {
      const levee = y === null;
      plumes[i].classList.toggle('plume-levee', levee);
      plumes[i].setAttribute('cy', (BANDE.regle + i * BANDE.piste + (levee ? BANDE.piste / 2 : y)).toFixed(1));
    });

    if (etat.pub !== enPub) {
      enPub = etat.pub;
      figure.classList.toggle('en-pub', enPub);
      lectureTwitch.textContent = enPub ? 'Une pub' : 'Le live';
      lectureRonflux.textContent = enPub ? 'Pub bloquée' : 'En veille';
    }

    const h = heure(p);
    if (h !== heureAffichee) {
      heureAffichee = h;
      lectureHeure.textContent = h;
    }
  }

  function avancer(t) {
    if (precedent !== null) ecoule += (Math.min(t - precedent, 100) / 1000) * BANDE.vitesse;
    precedent = t;
    dessiner();
    image = requestAnimationFrame(avancer);
  }

  function regler() {
    const tourner = visible && !enPause && !moinsAnimer.matches;
    if (tourner && !image) {
      precedent = null;
      image = requestAnimationFrame(avancer);
    } else if (!tourner && image) {
      cancelAnimationFrame(image);
      image = 0;
    }
    pause.hidden = moinsAnimer.matches;
  }

  pause.addEventListener('click', () => {
    enPause = !enPause;
    pause.textContent = enPause ? 'Reprendre' : 'Pause';
    regler();
  });

  new IntersectionObserver(([entree]) => {
    visible = entree.isIntersecting;
    regler();
  }).observe(figure);

  moinsAnimer.addEventListener('change', regler);
  regler();
}

bande();
