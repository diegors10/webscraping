const express = require('express');
const { scrapeFlights } = require('./app/scraping-final'); 
const { scrapeFeeds } = require('./app/scraping-feeds'); 


const app = express();
app.use(express.json());

// Endpoint para buscar passagens
app.post('/search-flights', async (req, res) => {
  const { client, number, textMessage, origin, destination, departureDate } = req.body;

  if (!client || !number || !textMessage || !origin || !destination || !departureDate) {
    return res.status(400).json({
      error: 'Os campos client, number, textMessage, origin, destination e departureDate são obrigatórios.',
    });
  }

  const [day, month, year] = departureDate.split('/');
  const formattedDate = `${year}-${month}-${day}`;

  try {
    const result = await scrapeFlights({ origin, destination, departureDate: formattedDate });

    return res.json({
      client,
      number,
      textMessage,
      results: result.result,
    });
  } catch (error) {
    console.error('Erro durante a execução do endpoint:', error);
    return res.status(500).json({ error: 'Erro durante o scraping. Tente novamente mais tarde.' });
  }
});

// Endpoint para buscar notícias com IA
app.get('/scrape-feeds', async (req, res) => {
  const filtro = req.query.filtro == 'false'; // false por padrão

  try {
    const resultado = await scrapeFeeds({ comFiltro: filtro });
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao processar /scrape-feeds:', err.message);
    res.status(500).json({ error: 'Erro durante scraping de feeds' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
