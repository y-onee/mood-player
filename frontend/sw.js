// A minimal service worker to satisfy PWA installability requirements
self.addEventListener('fetch', function(event) {
    // Leave fetch untouched so we don't break the YouTube iframe or API calls
});
