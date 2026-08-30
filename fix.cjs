const fs = require('fs');

// Fix VERSION
let version = fs.readFileSync('VERSION', 'utf8');
version = version.replace(/<<<<<<< HEAD\n.*\n=======\n(.*?)\n>>>>>>> origin\/main/s, '$1\n');
fs.writeFileSync('VERSION', version.trim() + '\n');

// Fix CHANGELOG.md
let changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
changelog = changelog.replace(/<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> origin\/main/s, '$2\n\n$1');
fs.writeFileSync('CHANGELOG.md', changelog);
