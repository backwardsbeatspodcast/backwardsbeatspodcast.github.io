document.addEventListener('DOMContentLoaded', function() {
  document.querySelector('.hamburger').addEventListener('click', function() {
    document.querySelector('.nav-list').classList.toggle('show');
  });
});

