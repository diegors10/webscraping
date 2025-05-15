const puppeteer = require('puppeteer');
const OpenAI = require('openai');
const dotenv = require('dotenv');
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const KEYWORDS = ['ia', 'inteligência artificial', 'machine learning'];

function containsKeyword(text) {
  const lower = text.toLowerCase();
  return KEYWORDS.some(keyword => lower.includes(keyword));
}

async function preparePage(browser, url) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
  });
  console.log(`Acessando URL: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return page;
}

async function scrapeWired(browser) {
  try {
    const url = process.env.URL_1;
    const page = await preparePage(browser, url);

    const data = await page.evaluate(() => {
      const articles = [];
      const nodes = document.querySelectorAll('a.SummaryItemHedLink-civMjp');

      nodes.forEach(linkEl => {
        const title = linkEl.innerText.trim();
        const href = linkEl.href;
        if (title && href) {
          articles.push({
            source: 'Wired – Artificial Intelligence',
            title,
            link: href,
            excerpt: ''
          });
        }
      });

      return articles.slice(0, 3);
    });

    await page.close();
    console.log(`Wired retornou ${data.length} artigos.`);
    return data;
  } catch (err) {
    console.warn('Erro no Wired:', err.message);
    return [];
  }
}

async function scrapeVentureBeat(browser) {
  try {
    const url = process.env.URL_2;
    const page = await preparePage(browser, url);

    const data = await page.evaluate(() => {
      const articles = [];
      const nodes = document.querySelectorAll('a.ArticleListing__title-link');

      nodes.forEach(linkEl => {
        const title = linkEl.innerText.trim();
        const href = linkEl.href;
        if (title && href) {
          articles.push({
            source: 'VentureBeat – Artificial Intelligence',
            title,
            link: href,
            excerpt: ''
          });
        }
      });

      return articles.slice(0, 3);
    });

    await page.close();
    console.log(`VentureBeat retornou ${data.length} artigos.`);
    return data;
  } catch (err) {
    console.warn('Erro no VentureBeat:', err.message);
    return [];
  }
}

async function gerarResumoOpenAI(texto) {
  try {
    console.log(`Gerando resumo para: ${texto.slice(0, 80)}...`);
    const prompt = `Resuma a seguinte notícia em 2 ou 3 frases objetivas, em português:\n\n"${texto}"`;

    const completion = await openai.chat.completions.create({
      model: 'o4-mini',
      messages: [{ role: 'user', content: prompt }]
    });

    const resumo = completion.choices[0].message.content.trim();
    console.log(`Resumo gerado: ${resumo.slice(0, 80)}...`);
    return resumo;
  } catch (err) {
    console.error('Erro ao gerar resumo:', err.message);
    return '(Erro ao gerar resumo)';
  }
}

async function scrapeFeeds({ comFiltro = false } = {}) {
  console.log('Iniciando scraping...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allArticles = [];

  const wired = await scrapeWired(browser);
  const venture = await scrapeVentureBeat(browser);

  allArticles.push(...wired, ...venture);
  console.log(`Total bruto de artigos: ${allArticles.length}`);

  await browser.close();

  let selecionados = allArticles;

  if (comFiltro) {
    selecionados = allArticles.filter(a => {
      const match = containsKeyword(a.title) || containsKeyword(a.excerpt);
      if (match) console.log(`Match: ${a.title}`);
      return match;
    });
    console.log(`Artigos relevantes com keywords: ${selecionados.length}`);
  }

  for (let artigo of selecionados) {
    const baseText = `${artigo.title}\n\n${artigo.excerpt}`;
    artigo.resumo = await gerarResumoOpenAI(baseText);
  }

  console.log('Scraping concluído com sucesso.');

  return {
    total: selecionados.length,
    keywords: comFiltro ? KEYWORDS : [],
    news: selecionados
  };
}

module.exports = { scrapeFeeds };
