const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scrapeFlights = async ({ origin, destination, departureDate }) => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    console.log("Acessando o site...");
    await page.goto("https://seats.aero/search", { waitUntil: "networkidle2" });

    console.log("Simulando comportamento humano...");
    await page.mouse.move(100, 100);
    await delay(6000);

    const captchaSelector = "p#TBuuD2.h2.spacer-bottom";
    const captchaExists = await page.$(captchaSelector);
    if (captchaExists) {
      console.log("Captcha detectado. Tentando resolver...");
      const checkboxSelector = 'label.cb-lb input[type="checkbox"]';
      await page.waitForSelector(checkboxSelector, { timeout: 10000 });
      await page.click(checkboxSelector);
      console.log("Captcha resolvido com sucesso.");
      await delay(5000);
    }

    console.log("Preenchendo campo de origem...");
    await page.waitForSelector(
      'input.vs__search[aria-labelledby="vs1__combobox"]'
    );
    await page.click('input.vs__search[aria-labelledby="vs1__combobox"]');
    for (const char of origin) await page.keyboard.type(char, { delay: 200 });
    await delay(1500);
    await page.keyboard.press("Enter");
    await delay(2000);

    console.log("Preenchendo campo de destino...");
    await page.waitForSelector(
      'input.vs__search[aria-labelledby="vs2__combobox"]'
    );
    await page.click('input.vs__search[aria-labelledby="vs2__combobox"]');
    for (const char of destination)
      await page.keyboard.type(char, { delay: 200 });
    await delay(1500);
    await page.keyboard.press("Enter");
    await delay(2000);

    console.log("Selecionando data...");
    const [year, month, day] = departureDate.split("-");
    await page.waitForSelector('input[data-test-id="dp-input"]');
    await page.click('input[data-test-id="dp-input"]');
    await delay(1000);

    await page.click('button[data-dp-element="overlay-year"]');
    await delay(500);
    await page.click(`div[data-test-id="${year}"]`);
    await delay(1000);

    await page.click('button[data-dp-element="overlay-month"]');
    await delay(500);
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    await page.click(
      `div[data-test-id="${monthNames[parseInt(month, 10) - 1]}"]`
    );
    await delay(1000);

    const daySelector = `div.dp__cell_inner.dp__pointer`;
    const days = await page.$$(daySelector);
    for (const element of days) {
      const text = await page.evaluate((el) => el.textContent.trim(), element);
      if (text === day) {
        await element.click();
        console.log(`Dia ${day} selecionado com sucesso.`);
        break;
      }
    }
    await delay(2000);

    console.log('Clicando no botão "Buscar"...');
    await page.click("button#submitSearch");
    await delay(3000);

    const alertSelector = ".alert.alert-warning";
    const alertExists = await page.$(alertSelector);
    if (alertExists) {
      const alertMessage = await page.evaluate(
        (alert) => alert.textContent.trim(),
        alertExists
      );
      console.log(`Alerta encontrado: ${alertMessage}`);
      return { result: alertMessage };
    }

    // console.log('Tentando clicar no botão "Econômica"...');
    // const economySelector = 'th[aria-label*="Economy"] span';
    // await page.waitForSelector(economySelector, { timeout: 15000 });
    // await page.click(economySelector);
    // console.log('Botão "Econômica" clicado.');
    // await delay(2000);

    console.log('Tentando clicar no botão "Econômica"...');

    try {
      const thSpans = await page.$$("th .dt-column-title");
      let found = false;

      for (const span of thSpans) {
        const text = await page.evaluate((el) => el.textContent.trim(), span);
        if (text.toLowerCase().includes("economy")) {
          await span.click();
          found = true;
          console.log('Botão "Econômica" clicado.');
          break;
        }
      }

      if (!found) {
        throw new Error('Coluna "Economy" não encontrada.');
      }

      await delay(2000);
    } catch (err) {
      console.error(`Erro ao tentar clicar em "Econômica": ${err.message}`);

      // Para debug:
      // await page.screenshot({ path: "erro_economica.png" });
      // const html = await page.content();
      // require("fs").writeFileSync("erro_economica.html", html);

      return { result: 'Não foi possível localizar a coluna "Economy".' };
    }

    console.log("Clicando no botão de mais informações...");
    const infoButtonSelector = "button.open-modal-btn";
    await page.waitForSelector(infoButtonSelector, { timeout: 20000 });
    const infoButtons = await page.$$(infoButtonSelector);

    if (infoButtons.length > 0) {
      await infoButtons[0].click();
      console.log("Botão de mais informações clicado.");
      await delay(5000);

      console.log("Extraindo links do pop-up...");
      const linkSelector = "#bookingOptions a.dropdown-item";
      await page.waitForSelector(linkSelector, { timeout: 20000 });
      const links = await page.$$eval(linkSelector, (elements) =>
        elements.map((el) => `${el.textContent.trim()}, Link:${el.href}`)
      );

      console.log("Links extraídos com sucesso.");
      return { result: links };
    } else {
      console.error("Nenhum botão de mais informações encontrado.");
      return { result: "Nenhum link de reserva encontrado." };
    }
  } catch (error) {
    console.error("Erro durante o scraping:", error);
    throw error;
  } finally {
    console.log("Fechando o navegador...");
    await browser.close();
  }
};

module.exports = { scrapeFlights };
