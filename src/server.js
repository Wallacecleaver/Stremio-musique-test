import app from './app.js';

const port = process.env.PORT || 7000;
app.listen(port, () => console.log(`Addon prêt : http://localhost:${port}/manifest.json`));
