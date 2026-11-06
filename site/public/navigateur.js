/*
 * Reconnaît le navigateur avant le premier affichage pour montrer d'emblée le bon bouton
 * d'installation, sans décalage. Rien n'est envoyé : le résultat reste sur la page, dans les
 * attributs data-nav et data-nav-nom de <html>. Sans JavaScript, la page propose le choix.
 */
(function () {
  var ua = navigator.userAgent || '';
  var uad = navigator.userAgentData;
  var marques = uad && uad.brands ? uad.brands.map(function (b) { return b.brand; }).join(' ') : '';
  var nav = 'autre';
  var nom = '';

  // Téléphones et tablettes d'abord, Firefox pour Android compris : Ronflux ne s'y installe pas.
  if (/iPhone|iPad|iPod|Android/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    nav = 'mobile';
  } else if (/Firefox\//.test(ua)) {
    nav = 'firefox';
  } else if (/Edg\//.test(ua) || /Edge/.test(marques)) {
    nav = 'chromium'; nom = 'Edge';
  } else if (/OPR\//.test(ua) || /Opera/.test(marques)) {
    nav = 'chromium'; nom = 'Opera';
  } else if (navigator.brave || /Brave/.test(marques)) {
    nav = 'chromium'; nom = 'Brave';
  } else if (/Chrome\//.test(ua) || /Chrom/.test(marques)) {
    nav = 'chromium'; nom = 'Chrome';
  }

  document.documentElement.setAttribute('data-nav', nav);
  if (nom) document.documentElement.setAttribute('data-nav-nom', nom);
})();
