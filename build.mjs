import fs from 'fs';
const dir = new URL('./', import.meta.url).pathname;
const read = (f) => fs.readFileSync(dir + f, 'utf8');
const esc = (s) => s.replace(/<\/script>/gi, '<\\/script>');

let html = read('index.html');
const css = read('style.css');
const lib = esc(read('exceljs.min.js'));
const app = esc(read('app.js'));

html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace('<script src="exceljs.min.js"></script>', () => `<script>\n${lib}\n</script>`);
html = html.replace('<script src="app.js"></script>', () => `<script>\n${app}\n</script>`);

fs.writeFileSync(dir + 'ponto.html', html);
console.log('ponto.html gerado:', (fs.statSync(dir + 'ponto.html').size / 1024).toFixed(0), 'KB');
