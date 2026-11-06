import './style.css';

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
